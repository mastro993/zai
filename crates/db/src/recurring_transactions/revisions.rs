use super::models::{
    RecurringScheduleRevisionRow, RecurringTemplateRevisionRow, schedule_rule_from_row,
};
use crate::errors::IntoCore;
use crate::schema::{recurring_schedule_revisions, recurring_template_revisions};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::recurring_transactions::{
    RecurringScheduleRevision, RecurringTemplateRevision,
};

pub fn find_schedule_revision_at(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    at_local: NaiveDateTime,
) -> Result<Option<RecurringScheduleRevision>> {
    let row = recurring_schedule_revisions::table
        .filter(recurring_schedule_revisions::recurring_transaction_id.eq(recurring_transaction_id))
        .filter(recurring_schedule_revisions::effective_from_local.le(at_local))
        .filter(
            recurring_schedule_revisions::effective_until_local
                .is_null()
                .or(recurring_schedule_revisions::effective_until_local.gt(at_local)),
        )
        .order(recurring_schedule_revisions::sequence.desc())
        .select(RecurringScheduleRevisionRow::as_select())
        .first::<RecurringScheduleRevisionRow>(conn)
        .optional()
        .into_core()?;

    row.map(|row| {
        let rule = schedule_rule_from_row(&row)?;
        Ok(RecurringScheduleRevision {
            id: row.id,
            recurring_transaction_id: row.recurring_transaction_id,
            sequence: row.sequence,
            effective_from_local: row.effective_from_local,
            effective_until_local: row.effective_until_local,
            first_scheduled_local: row.first_scheduled_local,
            rule,
        })
    })
    .transpose()
}

pub fn find_template_revision_at(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    at_local: NaiveDateTime,
) -> Result<Option<RecurringTemplateRevision>> {
    let row = recurring_template_revisions::table
        .filter(recurring_template_revisions::recurring_transaction_id.eq(recurring_transaction_id))
        .filter(recurring_template_revisions::effective_from_local.le(at_local))
        .filter(
            recurring_template_revisions::effective_until_local
                .is_null()
                .or(recurring_template_revisions::effective_until_local.gt(at_local)),
        )
        .order(recurring_template_revisions::sequence.desc())
        .select(RecurringTemplateRevisionRow::as_select())
        .first::<RecurringTemplateRevisionRow>(conn)
        .optional()
        .into_core()?;

    Ok(row.map(|row| RecurringTemplateRevision {
        id: row.id,
        recurring_transaction_id: row.recurring_transaction_id,
        sequence: row.sequence,
        effective_from_local: row.effective_from_local,
        effective_until_local: row.effective_until_local,
        description: row.description,
        amount: row.amount,
        transaction_type: row.transaction_type,
        transaction_category_id: row.transaction_category_id,
        notes: row.notes,
    }))
}
