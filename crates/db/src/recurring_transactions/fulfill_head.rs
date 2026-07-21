use super::models::{
    RecurringOccurrenceHeadRow, RecurringOccurrenceRow, RecurringTransactionRow, build_occurrence,
    build_recurring_transaction,
};
use super::revisions::find_schedule_revision_at;
use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::{recurring_occurrence_heads, recurring_occurrences, recurring_transactions};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    RecurringLifecycle, RecurringOccurrence, RecurringScheduleRevision, RecurringTransaction,
    scheduled_local_at,
};

pub(super) fn find_occurrence(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    schedule_revision_id: &str,
    ordinal: i32,
) -> Result<Option<RecurringOccurrence>> {
    let row = recurring_occurrences::table
        .filter(recurring_occurrences::recurring_transaction_id.eq(recurring_transaction_id))
        .filter(recurring_occurrences::schedule_revision_id.eq(schedule_revision_id))
        .filter(recurring_occurrences::ordinal.eq(ordinal))
        .select(RecurringOccurrenceRow::as_select())
        .first::<RecurringOccurrenceRow>(conn)
        .optional()
        .into_storage()?;
    row.map(build_occurrence)
        .transpose()
        .map_err(StorageError::from)
}

pub(super) fn heal_stale_head_after_existing_occurrence(
    conn: &mut SqliteConnection,
    head: &RecurringOccurrenceHeadRow,
    existing: &RecurringOccurrence,
    now: NaiveDateTime,
) -> Result<()> {
    let recurring_row = recurring_transactions::table
        .filter(recurring_transactions::id.eq(&head.recurring_transaction_id))
        .select(RecurringTransactionRow::as_select())
        .first::<RecurringTransactionRow>(conn)
        .into_storage()?;
    let mut recurring = build_recurring_transaction(recurring_row).map_err(StorageError::from)?;
    if recurring.fulfilled_count < existing.fulfillment_position {
        diesel::update(
            recurring_transactions::table.filter(recurring_transactions::id.eq(&recurring.id)),
        )
        .set((
            recurring_transactions::fulfilled_count.eq(existing.fulfillment_position),
            recurring_transactions::revision.eq(recurring.revision + 1),
            recurring_transactions::updated_at.eq(now),
        ))
        .execute(conn)
        .into_storage()?;
        recurring.fulfilled_count = existing.fulfillment_position;
        recurring.revision += 1;
    }

    let schedule = find_schedule_revision_at(conn, &recurring.id, existing.scheduled_local)
        .map_err(StorageError::from)?
        .ok_or_else(|| {
            StorageError::CoreError(Error::Repository(
                "Missing schedule revision while healing occurrence head".to_string(),
            ))
        })?;

    match plan_complete_or_advance(
        conn,
        &recurring,
        &schedule,
        existing.ordinal,
        existing.fulfillment_position,
    )? {
        HeadPlan::Completed => {
            diesel::delete(
                recurring_occurrence_heads::table
                    .filter(recurring_occurrence_heads::recurring_transaction_id.eq(&recurring.id)),
            )
            .execute(conn)
            .into_storage()?;
            diesel::update(
                recurring_transactions::table.filter(recurring_transactions::id.eq(&recurring.id)),
            )
            .set((
                recurring_transactions::lifecycle.eq(RecurringLifecycle::Completed.as_str()),
                recurring_transactions::lifecycle_changed_at.eq(now),
                recurring_transactions::fulfilled_count.eq(existing.fulfillment_position),
                recurring_transactions::updated_at.eq(now),
                recurring_transactions::paused_at.eq(None::<NaiveDateTime>),
            ))
            .execute(conn)
            .into_storage()?;
            Ok(())
        }
        HeadPlan::Advanced(next) => write_advanced_head(conn, &recurring.id, &next),
    }
}

pub(super) fn complete_or_advance_after_fulfillment(
    conn: &mut SqliteConnection,
    recurring: &RecurringTransaction,
    schedule: &RecurringScheduleRevision,
    fulfilled_ordinal: i32,
    new_fulfilled_count: i32,
    now: NaiveDateTime,
) -> Result<()> {
    match plan_complete_or_advance(
        conn,
        recurring,
        schedule,
        fulfilled_ordinal,
        new_fulfilled_count,
    )? {
        HeadPlan::Completed => {
            diesel::delete(
                recurring_occurrence_heads::table
                    .filter(recurring_occurrence_heads::recurring_transaction_id.eq(&recurring.id)),
            )
            .execute(conn)
            .into_storage()?;
            diesel::update(
                recurring_transactions::table.filter(recurring_transactions::id.eq(&recurring.id)),
            )
            .set((
                recurring_transactions::fulfilled_count.eq(new_fulfilled_count),
                recurring_transactions::revision.eq(recurring.revision + 1),
                recurring_transactions::lifecycle.eq(RecurringLifecycle::Completed.as_str()),
                recurring_transactions::lifecycle_changed_at.eq(now),
                recurring_transactions::updated_at.eq(now),
                recurring_transactions::paused_at.eq(None::<NaiveDateTime>),
            ))
            .execute(conn)
            .into_storage()?;
            Ok(())
        }
        HeadPlan::Advanced(next) => {
            write_advanced_head(conn, &recurring.id, &next)?;
            diesel::update(
                recurring_transactions::table.filter(recurring_transactions::id.eq(&recurring.id)),
            )
            .set((
                recurring_transactions::fulfilled_count.eq(new_fulfilled_count),
                recurring_transactions::revision.eq(recurring.revision + 1),
                recurring_transactions::updated_at.eq(now),
            ))
            .execute(conn)
            .into_storage()?;
            Ok(())
        }
    }
}

enum HeadPlan {
    Completed,
    Advanced(NextHead),
}

struct NextHead {
    schedule_revision_id: String,
    next_ordinal: i32,
    next_scheduled_local: NaiveDateTime,
}

fn plan_complete_or_advance(
    conn: &mut SqliteConnection,
    recurring: &RecurringTransaction,
    schedule: &RecurringScheduleRevision,
    fulfilled_ordinal: i32,
    new_fulfilled_count: i32,
) -> Result<HeadPlan> {
    if recurring
        .total_occurrences
        .is_some_and(|total| new_fulfilled_count >= total)
    {
        return Ok(HeadPlan::Completed);
    }

    Ok(HeadPlan::Advanced(next_head_after_occurrence(
        conn,
        &recurring.id,
        schedule,
        fulfilled_ordinal,
    )?))
}

fn next_head_after_occurrence(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    current_schedule: &RecurringScheduleRevision,
    fulfilled_ordinal: i32,
) -> Result<NextHead> {
    let next_ordinal = fulfilled_ordinal + 1;
    let provisional = scheduled_local_at(
        &current_schedule.rule,
        current_schedule.first_scheduled_local,
        next_ordinal,
    )
    .map_err(StorageError::CoreError)?;

    let selected = find_schedule_revision_at(conn, recurring_transaction_id, provisional)
        .map_err(StorageError::from)?
        .unwrap_or_else(|| current_schedule.clone());

    if selected.id == current_schedule.id {
        return Ok(NextHead {
            schedule_revision_id: current_schedule.id.clone(),
            next_ordinal,
            next_scheduled_local: provisional,
        });
    }

    let next_scheduled_local =
        scheduled_local_at(&selected.rule, selected.first_scheduled_local, 1)
            .map_err(StorageError::CoreError)?;
    Ok(NextHead {
        schedule_revision_id: selected.id,
        next_ordinal: 1,
        next_scheduled_local,
    })
}

fn write_advanced_head(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    next: &NextHead,
) -> Result<()> {
    diesel::update(
        recurring_occurrence_heads::table.filter(
            recurring_occurrence_heads::recurring_transaction_id.eq(recurring_transaction_id),
        ),
    )
    .set((
        recurring_occurrence_heads::schedule_revision_id.eq(&next.schedule_revision_id),
        recurring_occurrence_heads::next_ordinal.eq(next.next_ordinal),
        recurring_occurrence_heads::next_scheduled_local.eq(next.next_scheduled_local),
    ))
    .execute(conn)
    .into_storage()?;
    Ok(())
}
