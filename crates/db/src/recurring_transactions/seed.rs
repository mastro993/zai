use super::models::{
    RecurringOccurrenceHeadRow, RecurringScheduleRevisionRow, RecurringTemplateRevisionRow,
    RecurringTransactionRow,
};
use crate::errors::{IntoStorage, Result};
use crate::schema::{
    recurring_occurrence_heads, recurring_schedule_revisions, recurring_template_revisions,
    recurring_transactions,
};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;

pub struct SeedRecurringSource {
    pub id: String,
    pub name: String,
    pub lifecycle: &'static str,
    pub total_occurrences: Option<i32>,
    pub fulfilled_count: i32,
    pub revision: i32,
    pub first_scheduled_local: NaiveDateTime,
    pub next_scheduled_local: NaiveDateTime,
    pub next_ordinal: i32,
    pub amount: i32,
    pub transaction_type: &'static str,
}

pub fn seed_active_interval_source(
    conn: &mut SqliteConnection,
    seed: &SeedRecurringSource,
) -> Result<(String, String)> {
    let now = chrono::Utc::now().naive_utc();
    let schedule_revision_id = format!("{}-sched-1", seed.id);
    let template_revision_id = format!("{}-tmpl-1", seed.id);

    diesel::insert_into(recurring_transactions::table)
        .values(RecurringTransactionRow {
            id: seed.id.clone(),
            name: seed.name.clone(),
            lifecycle: seed.lifecycle.to_string(),
            total_occurrences: seed.total_occurrences,
            fulfilled_count: seed.fulfilled_count,
            revision: seed.revision,
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
            recurring_transaction_id: seed.id.clone(),
            sequence: 1,
            effective_from_local: seed.first_scheduled_local,
            effective_until_local: None,
            first_scheduled_local: seed.first_scheduled_local,
            interval_every: Some(1),
            interval_unit: Some("month".to_string()),
            monthly_day: None,
        })
        .execute(conn)
        .into_storage()?;

    diesel::insert_into(recurring_template_revisions::table)
        .values(RecurringTemplateRevisionRow {
            id: template_revision_id.clone(),
            recurring_transaction_id: seed.id.clone(),
            sequence: 1,
            effective_from_local: seed.first_scheduled_local,
            effective_until_local: None,
            description: Some(format!("{} template", seed.name)),
            amount: seed.amount,
            transaction_type: seed.transaction_type.to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .execute(conn)
        .into_storage()?;

    diesel::insert_into(recurring_occurrence_heads::table)
        .values(RecurringOccurrenceHeadRow {
            recurring_transaction_id: seed.id.clone(),
            schedule_revision_id: schedule_revision_id.clone(),
            next_ordinal: seed.next_ordinal,
            next_scheduled_local: seed.next_scheduled_local,
        })
        .execute(conn)
        .into_storage()?;

    Ok((schedule_revision_id, template_revision_id))
}
