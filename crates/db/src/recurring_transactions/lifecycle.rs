use super::create::find_open_schedule_revision;
use super::models::{
    RecurringOccurrenceHeadRow, RecurringTransactionRow, build_recurring_transaction,
};
use super::revisions::find_schedule_revision_at;
use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::{recurring_occurrence_heads, recurring_transactions};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    RecurringLifecycle, RecurringLifecycleCommand, RecurringLifecycleUpdate, RecurringTransaction,
    advance_head_past_observation, scheduled_local_at, transition_allowed,
};

pub(super) fn apply_lifecycle_command(
    conn: &mut SqliteConnection,
    command: RecurringLifecycleCommand,
    update: RecurringLifecycleUpdate,
    observed_local: NaiveDateTime,
    now: NaiveDateTime,
) -> Result<RecurringTransaction> {
    update
        .validate_revision()
        .map_err(StorageError::CoreError)?;

    let row = recurring_transactions::table
        .filter(recurring_transactions::id.eq(&update.recurring_transaction_id))
        .select(RecurringTransactionRow::as_select())
        .first::<RecurringTransactionRow>(conn)
        .into_storage()?;
    let mut recurring = build_recurring_transaction(row).map_err(StorageError::from)?;

    if recurring.revision != update.expected_revision {
        return Err(StorageError::CoreError(Error::RevisionConflict {
            current_revision: i64::from(recurring.revision),
        }));
    }

    if !transition_allowed(recurring.lifecycle, command) {
        return Err(StorageError::CoreError(Error::InvalidData(format!(
            "Cannot {} recurring transaction in {} lifecycle",
            command_label(command),
            recurring.lifecycle.as_str()
        ))));
    }

    match command {
        RecurringLifecycleCommand::Pause => {
            apply_pause(conn, &mut recurring, now)?;
        }
        RecurringLifecycleCommand::Resume => {
            skip_head_past_observation(conn, &recurring, observed_local)?;
            apply_resume(conn, &mut recurring, now)?;
        }
        RecurringLifecycleCommand::Stop => {
            apply_stop(conn, &mut recurring, now)?;
        }
        RecurringLifecycleCommand::Tombstone => {
            apply_tombstone(conn, &mut recurring, now)?;
        }
    }

    get_recurring_row(conn, &recurring.id)
}

fn apply_pause(
    conn: &mut SqliteConnection,
    recurring: &mut RecurringTransaction,
    now: NaiveDateTime,
) -> Result<()> {
    let revision = next_revision(recurring.revision)?;
    diesel::update(
        recurring_transactions::table.filter(recurring_transactions::id.eq(&recurring.id)),
    )
    .set((
        recurring_transactions::lifecycle.eq(RecurringLifecycle::Paused.as_str()),
        recurring_transactions::lifecycle_changed_at.eq(now),
        recurring_transactions::paused_at.eq(Some(now)),
        recurring_transactions::updated_at.eq(now),
        recurring_transactions::revision.eq(revision),
    ))
    .execute(conn)
    .into_storage()?;
    recurring.lifecycle = RecurringLifecycle::Paused;
    recurring.paused_at = Some(now);
    recurring.lifecycle_changed_at = now;
    recurring.revision = revision;
    Ok(())
}

fn apply_resume(
    conn: &mut SqliteConnection,
    recurring: &mut RecurringTransaction,
    now: NaiveDateTime,
) -> Result<()> {
    let revision = next_revision(recurring.revision)?;
    diesel::update(
        recurring_transactions::table.filter(recurring_transactions::id.eq(&recurring.id)),
    )
    .set((
        recurring_transactions::lifecycle.eq(RecurringLifecycle::Active.as_str()),
        recurring_transactions::lifecycle_changed_at.eq(now),
        recurring_transactions::paused_at.eq(None::<NaiveDateTime>),
        recurring_transactions::updated_at.eq(now),
        recurring_transactions::revision.eq(revision),
    ))
    .execute(conn)
    .into_storage()?;
    recurring.lifecycle = RecurringLifecycle::Active;
    recurring.paused_at = None;
    recurring.lifecycle_changed_at = now;
    recurring.revision = revision;
    Ok(())
}

fn apply_stop(
    conn: &mut SqliteConnection,
    recurring: &mut RecurringTransaction,
    now: NaiveDateTime,
) -> Result<()> {
    delete_head(conn, &recurring.id)?;
    let revision = next_revision(recurring.revision)?;
    diesel::update(
        recurring_transactions::table.filter(recurring_transactions::id.eq(&recurring.id)),
    )
    .set((
        recurring_transactions::lifecycle.eq(RecurringLifecycle::Stopped.as_str()),
        recurring_transactions::lifecycle_changed_at.eq(now),
        recurring_transactions::paused_at.eq(None::<NaiveDateTime>),
        recurring_transactions::updated_at.eq(now),
        recurring_transactions::revision.eq(revision),
    ))
    .execute(conn)
    .into_storage()?;
    recurring.lifecycle = RecurringLifecycle::Stopped;
    recurring.paused_at = None;
    recurring.lifecycle_changed_at = now;
    recurring.revision = revision;
    Ok(())
}

fn apply_tombstone(
    conn: &mut SqliteConnection,
    recurring: &mut RecurringTransaction,
    now: NaiveDateTime,
) -> Result<()> {
    delete_head(conn, &recurring.id)?;
    let revision = next_revision(recurring.revision)?;
    diesel::update(
        recurring_transactions::table.filter(recurring_transactions::id.eq(&recurring.id)),
    )
    .set((
        recurring_transactions::lifecycle.eq(RecurringLifecycle::Tombstoned.as_str()),
        recurring_transactions::lifecycle_changed_at.eq(now),
        recurring_transactions::paused_at.eq(None::<NaiveDateTime>),
        recurring_transactions::deleted_at.eq(Some(now)),
        recurring_transactions::updated_at.eq(now),
        recurring_transactions::revision.eq(revision),
    ))
    .execute(conn)
    .into_storage()?;
    recurring.lifecycle = RecurringLifecycle::Tombstoned;
    recurring.paused_at = None;
    recurring.deleted_at = Some(now);
    recurring.lifecycle_changed_at = now;
    recurring.revision = revision;
    Ok(())
}

pub(super) fn skip_head_past_observation(
    conn: &mut SqliteConnection,
    recurring: &RecurringTransaction,
    observed_local: NaiveDateTime,
) -> Result<()> {
    let head = recurring_occurrence_heads::table
        .filter(recurring_occurrence_heads::recurring_transaction_id.eq(&recurring.id))
        .select(RecurringOccurrenceHeadRow::as_select())
        .first::<RecurringOccurrenceHeadRow>(conn)
        .optional()
        .into_storage()?;
    let Some(head) = head else {
        return Ok(());
    };
    if head.next_scheduled_local > observed_local {
        return Ok(());
    }

    let schedule = find_schedule_revision_at(conn, &recurring.id, head.next_scheduled_local)
        .map_err(StorageError::from)?
        .or_else(|| {
            find_open_schedule_revision(conn, &recurring.id)
                .ok()
                .flatten()
        })
        .ok_or_else(|| {
            StorageError::CoreError(Error::Repository(
                "Missing schedule revision while skipping paused occurrences".to_string(),
            ))
        })?;

    let (next_ordinal, next_scheduled_local) = advance_head_past_observation(
        &schedule.rule,
        schedule.first_scheduled_local,
        head.next_ordinal,
        head.next_scheduled_local,
        observed_local,
    )
    .map_err(StorageError::CoreError)?;

    // Re-select schedule at the advanced local in case a future revision starts there.
    let selected = find_schedule_revision_at(conn, &recurring.id, next_scheduled_local)
        .map_err(StorageError::from)?
        .unwrap_or(schedule.clone());

    let (final_revision_id, final_ordinal, final_local) = if selected.id == schedule.id {
        (schedule.id.clone(), next_ordinal, next_scheduled_local)
    } else {
        let scheduled = scheduled_local_at(&selected.rule, selected.first_scheduled_local, 1)
            .map_err(StorageError::CoreError)?;
        if scheduled <= observed_local {
            let (ordinal, local) = advance_head_past_observation(
                &selected.rule,
                selected.first_scheduled_local,
                1,
                scheduled,
                observed_local,
            )
            .map_err(StorageError::CoreError)?;
            (selected.id.clone(), ordinal, local)
        } else {
            (selected.id.clone(), 1, scheduled)
        }
    };

    diesel::update(
        recurring_occurrence_heads::table
            .filter(recurring_occurrence_heads::recurring_transaction_id.eq(&recurring.id)),
    )
    .set((
        recurring_occurrence_heads::schedule_revision_id.eq(final_revision_id),
        recurring_occurrence_heads::next_ordinal.eq(final_ordinal),
        recurring_occurrence_heads::next_scheduled_local.eq(final_local),
    ))
    .execute(conn)
    .into_storage()?;
    Ok(())
}

fn delete_head(conn: &mut SqliteConnection, recurring_transaction_id: &str) -> Result<()> {
    diesel::delete(
        recurring_occurrence_heads::table.filter(
            recurring_occurrence_heads::recurring_transaction_id.eq(recurring_transaction_id),
        ),
    )
    .execute(conn)
    .into_storage()?;
    Ok(())
}

fn get_recurring_row(conn: &mut SqliteConnection, id: &str) -> Result<RecurringTransaction> {
    let row = recurring_transactions::table
        .filter(recurring_transactions::id.eq(id))
        .select(RecurringTransactionRow::as_select())
        .first::<RecurringTransactionRow>(conn)
        .into_storage()?;
    build_recurring_transaction(row).map_err(StorageError::from)
}

fn next_revision(current: i32) -> Result<i32> {
    current.checked_add(1).ok_or_else(|| {
        StorageError::CoreError(Error::InvalidData(
            "Recurring transaction revision overflow".to_string(),
        ))
    })
}

fn command_label(command: RecurringLifecycleCommand) -> &'static str {
    match command {
        RecurringLifecycleCommand::Pause => "pause",
        RecurringLifecycleCommand::Resume => "resume",
        RecurringLifecycleCommand::Stop => "stop",
        RecurringLifecycleCommand::Tombstone => "tombstone",
    }
}
