use crate::schema::{
    recurring_generation_failures, recurring_occurrence_heads, recurring_occurrences,
    recurring_schedule_revisions, recurring_template_revisions, recurring_transactions,
};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use zai_core::features::recurring_transactions::{
    FulfillmentKind, RecurringGenerationFailure, RecurringLifecycle, RecurringOccurrence,
    RecurringOccurrenceHead, RecurringTransaction, ScheduleIntervalUnit, ScheduleRule,
};
use zai_core::{Error, Result};

#[derive(Queryable, Identifiable, Insertable, Selectable, Debug, Clone)]
#[diesel(table_name = recurring_transactions)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct RecurringTransactionRow {
    pub id: String,
    pub name: String,
    pub lifecycle: String,
    pub total_occurrences: Option<i32>,
    pub fulfilled_count: i32,
    pub revision: i32,
    pub lifecycle_changed_at: NaiveDateTime,
    pub paused_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub deleted_at: Option<NaiveDateTime>,
}

#[derive(Queryable, Identifiable, Insertable, Selectable, Debug, Clone)]
#[diesel(table_name = recurring_schedule_revisions)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct RecurringScheduleRevisionRow {
    pub id: String,
    pub recurring_transaction_id: String,
    pub sequence: i32,
    pub effective_from_local: NaiveDateTime,
    pub effective_until_local: Option<NaiveDateTime>,
    pub first_scheduled_local: NaiveDateTime,
    pub interval_every: Option<i32>,
    pub interval_unit: Option<String>,
    pub monthly_day: Option<i32>,
}

#[derive(Queryable, Identifiable, Insertable, Selectable, Debug, Clone)]
#[diesel(table_name = recurring_template_revisions)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct RecurringTemplateRevisionRow {
    pub id: String,
    pub recurring_transaction_id: String,
    pub sequence: i32,
    pub effective_from_local: NaiveDateTime,
    pub effective_until_local: Option<NaiveDateTime>,
    pub description: Option<String>,
    pub amount: i32,
    pub transaction_type: String,
    pub transaction_category_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Queryable, Identifiable, Insertable, Selectable, Debug, Clone)]
#[diesel(table_name = recurring_occurrence_heads)]
#[diesel(primary_key(recurring_transaction_id))]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct RecurringOccurrenceHeadRow {
    pub recurring_transaction_id: String,
    pub schedule_revision_id: String,
    pub next_ordinal: i32,
    pub next_scheduled_local: NaiveDateTime,
}

#[derive(Queryable, Identifiable, Insertable, Selectable, Debug, Clone)]
#[diesel(table_name = recurring_occurrences)]
#[diesel(primary_key(recurring_transaction_id, schedule_revision_id, ordinal))]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct RecurringOccurrenceRow {
    pub recurring_transaction_id: String,
    pub schedule_revision_id: String,
    pub ordinal: i32,
    pub scheduled_local: NaiveDateTime,
    pub template_revision_id: String,
    pub fulfilled_at: NaiveDateTime,
    pub fulfillment_position: i32,
    pub transaction_id: String,
    pub fulfillment_kind: String,
    pub recurring_alert_id: Option<String>,
}

#[derive(Queryable, Identifiable, Insertable, Selectable, Debug, Clone)]
#[diesel(table_name = recurring_generation_failures)]
#[diesel(primary_key(recurring_transaction_id, schedule_revision_id, ordinal))]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct RecurringGenerationFailureRow {
    pub recurring_transaction_id: String,
    pub schedule_revision_id: String,
    pub ordinal: i32,
    pub error_code: String,
    pub cause_category: String,
    pub repair_field_key: Option<String>,
    pub correlation_id: String,
    pub failed_scheduled_local: NaiveDateTime,
    pub first_failed_at: NaiveDateTime,
    pub last_failed_at: NaiveDateTime,
    pub attempt_count: i32,
    pub repaired_at: Option<NaiveDateTime>,
    pub repair_revision: Option<i32>,
    pub resolved_at: Option<NaiveDateTime>,
    pub resolution_kind: Option<String>,
    pub generation_failure_alert_id: String,
}

pub fn build_recurring_transaction(row: RecurringTransactionRow) -> Result<RecurringTransaction> {
    let lifecycle = row
        .lifecycle
        .parse::<RecurringLifecycle>()
        .map_err(|_| Error::Repository("Invalid recurring lifecycle".to_string()))?;
    Ok(RecurringTransaction {
        id: row.id,
        name: row.name,
        lifecycle,
        total_occurrences: row.total_occurrences,
        fulfilled_count: row.fulfilled_count,
        revision: row.revision,
        lifecycle_changed_at: row.lifecycle_changed_at,
        paused_at: row.paused_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
    })
}

pub fn build_occurrence_head(row: RecurringOccurrenceHeadRow) -> RecurringOccurrenceHead {
    RecurringOccurrenceHead {
        recurring_transaction_id: row.recurring_transaction_id,
        schedule_revision_id: row.schedule_revision_id,
        next_ordinal: row.next_ordinal,
        next_scheduled_local: row.next_scheduled_local,
    }
}

pub fn build_occurrence(row: RecurringOccurrenceRow) -> Result<RecurringOccurrence> {
    let fulfillment_kind = row
        .fulfillment_kind
        .parse::<FulfillmentKind>()
        .map_err(|_| Error::Repository("Invalid fulfillment kind".to_string()))?;
    Ok(RecurringOccurrence {
        recurring_transaction_id: row.recurring_transaction_id,
        schedule_revision_id: row.schedule_revision_id,
        ordinal: row.ordinal,
        scheduled_local: row.scheduled_local,
        template_revision_id: row.template_revision_id,
        fulfilled_at: row.fulfilled_at,
        fulfillment_position: row.fulfillment_position,
        transaction_id: row.transaction_id,
        fulfillment_kind,
        recurring_alert_id: row.recurring_alert_id,
    })
}

pub fn build_generation_failure(row: RecurringGenerationFailureRow) -> RecurringGenerationFailure {
    RecurringGenerationFailure {
        recurring_transaction_id: row.recurring_transaction_id,
        schedule_revision_id: row.schedule_revision_id,
        ordinal: row.ordinal,
        error_code: row.error_code,
        cause_category: row.cause_category,
        repair_field_key: row.repair_field_key,
        correlation_id: row.correlation_id,
        failed_scheduled_local: row.failed_scheduled_local,
        first_failed_at: row.first_failed_at,
        last_failed_at: row.last_failed_at,
        attempt_count: row.attempt_count,
        repaired_at: row.repaired_at,
        repair_revision: row.repair_revision,
        resolved_at: row.resolved_at,
        resolution_kind: row.resolution_kind,
        generation_failure_alert_id: row.generation_failure_alert_id,
    }
}

pub fn schedule_rule_from_row(row: &RecurringScheduleRevisionRow) -> Result<ScheduleRule> {
    match (
        row.interval_every,
        row.interval_unit.as_deref(),
        row.monthly_day,
    ) {
        (Some(every), Some(unit), None) => {
            let unit = unit
                .parse::<ScheduleIntervalUnit>()
                .map_err(|_| Error::Repository("Invalid schedule interval unit".to_string()))?;
            Ok(ScheduleRule::Interval { every, unit })
        }
        (None, None, Some(day)) => Ok(ScheduleRule::MonthlyDay { day }),
        _ => Err(Error::Repository(
            "Invalid schedule revision rule shape".to_string(),
        )),
    }
}
