use super::models::{
    RecurringOccurrenceHeadRow, RecurringOccurrenceRow, RecurringTransactionRow, build_occurrence,
    build_recurring_transaction,
};
use super::queries::find_unresolved_failure;
use super::revisions::find_schedule_revision_at;
use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::{recurring_occurrence_heads, recurring_occurrences, recurring_transactions};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    RecurringLifecycle, RecurringOccurrence, scheduled_local_at,
};

pub(super) fn find_next_eligible_due_head(
    conn: &mut SqliteConnection,
    observed_local: NaiveDateTime,
) -> Result<Option<RecurringOccurrenceHeadRow>> {
    let heads = recurring_occurrence_heads::table
        .inner_join(recurring_transactions::table.on(
            recurring_occurrence_heads::recurring_transaction_id.eq(recurring_transactions::id),
        ))
        .filter(recurring_occurrence_heads::next_scheduled_local.le(observed_local))
        .filter(recurring_transactions::lifecycle.eq(RecurringLifecycle::Active.as_str()))
        .filter(recurring_transactions::deleted_at.is_null())
        .order((
            recurring_occurrence_heads::next_scheduled_local.asc(),
            recurring_occurrence_heads::recurring_transaction_id.asc(),
        ))
        .select(RecurringOccurrenceHeadRow::as_select())
        .load::<RecurringOccurrenceHeadRow>(conn)
        .into_storage()?;

    for head in heads {
        let blocking = find_unresolved_failure(conn, &head.recurring_transaction_id)
            .map_err(StorageError::from)?
            .filter(|failure| failure.repaired_at.is_none());
        if blocking.is_some() {
            continue;
        }
        return Ok(Some(head));
    }
    Ok(None)
}

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
    let recurring = build_recurring_transaction(recurring_row).map_err(StorageError::from)?;
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
    }

    let completed = recurring
        .total_occurrences
        .is_some_and(|total| existing.fulfillment_position >= total);
    if completed {
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
        return Ok(());
    }

    let schedule = find_schedule_revision_at(conn, &recurring.id, existing.scheduled_local)
        .map_err(StorageError::from)?
        .ok_or_else(|| {
            StorageError::CoreError(Error::Repository(
                "Missing schedule revision while healing occurrence head".to_string(),
            ))
        })?;
    let next_ordinal = existing.ordinal + 1;
    let next_scheduled_local =
        scheduled_local_at(&schedule.rule, schedule.first_scheduled_local, next_ordinal)
            .map_err(StorageError::CoreError)?;
    let next_schedule = find_schedule_revision_at(conn, &recurring.id, next_scheduled_local)
        .map_err(StorageError::from)?
        .unwrap_or(schedule);
    diesel::update(
        recurring_occurrence_heads::table
            .filter(recurring_occurrence_heads::recurring_transaction_id.eq(&recurring.id)),
    )
    .set((
        recurring_occurrence_heads::schedule_revision_id.eq(next_schedule.id),
        recurring_occurrence_heads::next_ordinal.eq(next_ordinal),
        recurring_occurrence_heads::next_scheduled_local.eq(next_scheduled_local),
    ))
    .execute(conn)
    .into_storage()?;
    Ok(())
}
