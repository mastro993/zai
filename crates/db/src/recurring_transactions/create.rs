use super::models::{
    RecurringOccurrenceHeadRow, RecurringScheduleRevisionRow, RecurringTemplateRevisionRow,
    RecurringTransactionRow, schedule_rule_from_row,
};
use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::{
    recurring_occurrence_heads, recurring_schedule_revisions, recurring_template_revisions,
    recurring_transactions,
};
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use uuid::Uuid;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    NewRecurringTransaction, RecurringScheduleRevision, RecurringTemplateRevision,
    RecurringTransaction, ScheduleRule,
};

pub fn create_recurring_transaction(
    conn: &mut SqliteConnection,
    input: NewRecurringTransaction,
) -> Result<RecurringTransaction> {
    let id = input.id.clone().ok_or_else(|| {
        StorageError::CoreError(Error::InvalidData(
            "Recurring transaction id is required".to_string(),
        ))
    })?;
    let now = chrono::Utc::now().naive_utc();
    let schedule_revision_id = Uuid::new_v4().to_string();
    let template_revision_id = Uuid::new_v4().to_string();
    let first_scheduled_local = input.first_scheduled_local;

    let (interval_every, interval_unit, monthly_day) = schedule_columns(&input.schedule);

    diesel::insert_into(recurring_transactions::table)
        .values(RecurringTransactionRow {
            id: id.clone(),
            lifecycle: "active".to_string(),
            total_occurrences: input.total_occurrences,
            fulfilled_count: 0,
            revision: 1,
            lifecycle_changed_at: now,
            paused_at: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        })
        .execute(conn)
        .into_storage()?;

    diesel::insert_into(recurring_schedule_revisions::table)
        .values(RecurringScheduleRevisionRow {
            id: schedule_revision_id.clone(),
            recurring_transaction_id: id.clone(),
            sequence: 1,
            effective_from_local: first_scheduled_local,
            effective_until_local: None,
            first_scheduled_local,
            interval_every,
            interval_unit,
            monthly_day,
        })
        .execute(conn)
        .into_storage()?;

    diesel::insert_into(recurring_template_revisions::table)
        .values(RecurringTemplateRevisionRow {
            id: template_revision_id,
            recurring_transaction_id: id.clone(),
            sequence: 1,
            effective_from_local: first_scheduled_local,
            effective_until_local: None,
            description: input.template.description,
            amount: input.template.amount,
            transaction_type: input.template.transaction_type,
            transaction_category_id: input.template.transaction_category_id,
            notes: input.template.notes,
        })
        .execute(conn)
        .into_storage()?;

    diesel::insert_into(recurring_occurrence_heads::table)
        .values(RecurringOccurrenceHeadRow {
            recurring_transaction_id: id.clone(),
            schedule_revision_id,
            next_ordinal: 1,
            next_scheduled_local: first_scheduled_local,
        })
        .execute(conn)
        .into_storage()?;

    super::queries::get_recurring_transaction(conn, &id).map_err(StorageError::from)
}

pub fn find_open_schedule_revision(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
) -> zai_core::Result<Option<RecurringScheduleRevision>> {
    let row = recurring_schedule_revisions::table
        .filter(recurring_schedule_revisions::recurring_transaction_id.eq(recurring_transaction_id))
        .filter(recurring_schedule_revisions::effective_until_local.is_null())
        .order(recurring_schedule_revisions::sequence.desc())
        .select(RecurringScheduleRevisionRow::as_select())
        .first::<RecurringScheduleRevisionRow>(conn)
        .optional()
        .map_err(StorageError::from)
        .map_err(Error::from)?;

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

pub fn find_open_template_revision(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
) -> zai_core::Result<Option<RecurringTemplateRevision>> {
    let row = recurring_template_revisions::table
        .filter(recurring_template_revisions::recurring_transaction_id.eq(recurring_transaction_id))
        .filter(recurring_template_revisions::effective_until_local.is_null())
        .order(recurring_template_revisions::sequence.desc())
        .select(RecurringTemplateRevisionRow::as_select())
        .first::<RecurringTemplateRevisionRow>(conn)
        .optional()
        .map_err(StorageError::from)
        .map_err(Error::from)?;

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

fn schedule_columns(rule: &ScheduleRule) -> (Option<i32>, Option<String>, Option<i32>) {
    match rule {
        ScheduleRule::Interval { every, unit } => {
            (Some(*every), Some(unit.as_str().to_string()), None)
        }
        ScheduleRule::MonthlyDay { day } => (None, None, Some(*day)),
    }
}
