use super::models::RecurringOccurrenceHeadRow;
use crate::errors::{IntoStorage, Result};
use crate::schema::{
    recurring_generation_failures, recurring_occurrence_heads, recurring_transactions,
};
use chrono::NaiveDateTime;
use diesel::dsl::{exists, not};
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::features::recurring_transactions::RecurringLifecycle;

pub(super) fn find_next_eligible_due_head(
    conn: &mut SqliteConnection,
    observed_local: NaiveDateTime,
) -> Result<Option<RecurringOccurrenceHeadRow>> {
    let blocking_failure = recurring_generation_failures::table
        .filter(
            recurring_generation_failures::recurring_transaction_id
                .eq(recurring_occurrence_heads::recurring_transaction_id),
        )
        .filter(recurring_generation_failures::resolved_at.is_null())
        .filter(recurring_generation_failures::repaired_at.is_null())
        .select(recurring_generation_failures::recurring_transaction_id);

    recurring_occurrence_heads::table
        .inner_join(recurring_transactions::table.on(
            recurring_occurrence_heads::recurring_transaction_id.eq(recurring_transactions::id),
        ))
        .filter(recurring_occurrence_heads::next_scheduled_local.le(observed_local))
        .filter(recurring_transactions::lifecycle.eq(RecurringLifecycle::Active.as_str()))
        .filter(recurring_transactions::deleted_at.is_null())
        .filter(not(exists(blocking_failure)))
        .order((
            recurring_occurrence_heads::next_scheduled_local.asc(),
            recurring_occurrence_heads::recurring_transaction_id.asc(),
            recurring_occurrence_heads::schedule_revision_id.asc(),
            recurring_occurrence_heads::next_ordinal.asc(),
        ))
        .select(RecurringOccurrenceHeadRow::as_select())
        .first::<RecurringOccurrenceHeadRow>(conn)
        .optional()
        .into_storage()
}

pub(super) fn has_eligible_due_occurrence(
    conn: &mut SqliteConnection,
    observed_local: NaiveDateTime,
) -> Result<bool> {
    Ok(find_next_eligible_due_head(conn, observed_local)?.is_some())
}
