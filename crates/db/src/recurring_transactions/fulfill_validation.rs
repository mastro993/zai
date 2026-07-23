use super::generation_failure::record as record_generation_failure;
use super::models::RecurringOccurrenceHeadRow;
use super::revisions::{find_schedule_revision_at, find_template_revision_at};
use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::transaction_categories;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    INVALID_CATEGORY_ERROR_CODE, ProcessOneOutcome, RecurringRepairField,
    RecurringScheduleRevision, RecurringTemplateRevision, scheduled_local_at,
};
use zai_core::features::transactions::models::NewTransaction;

pub(super) enum GenerationValidation {
    Ready {
        schedule: RecurringScheduleRevision,
        template: RecurringTemplateRevision,
        scheduled_local: NaiveDateTime,
    },
    Failed(zai_core::features::domain_alerts::CommittedOutcome<ProcessOneOutcome>),
}

pub(super) fn validate_generation_inputs(
    conn: &mut SqliteConnection,
    head: &RecurringOccurrenceHeadRow,
    now: NaiveDateTime,
) -> Result<GenerationValidation> {
    let Some(schedule) = find_schedule_revision_at(
        conn,
        &head.recurring_transaction_id,
        head.next_scheduled_local,
    )
    .map_err(StorageError::from)?
    else {
        return Err(StorageError::CoreError(Error::Repository(format!(
            "Missing schedule revision for {}",
            head.recurring_transaction_id
        ))));
    };
    if schedule.id != head.schedule_revision_id {
        return Err(StorageError::CoreError(Error::Repository(
            "Occurrence head schedule revision does not match effective revision".to_string(),
        )));
    }

    let Some(template) = find_template_revision_at(
        conn,
        &head.recurring_transaction_id,
        head.next_scheduled_local,
    )
    .map_err(StorageError::from)?
    else {
        return failure(
            conn,
            head,
            now,
            "missing_template_revision",
            "reference",
            None,
        );
    };

    let scheduled_local = scheduled_local_at(
        &schedule.rule,
        schedule.first_scheduled_local,
        head.next_ordinal,
    )
    .map_err(StorageError::CoreError)?;
    if scheduled_local != head.next_scheduled_local {
        return Err(StorageError::CoreError(Error::Repository(
            "Occurrence head scheduled local does not match schedule calculation".to_string(),
        )));
    }

    if let Some(category_id) = template.transaction_category_id.as_deref() {
        let category_exists = transaction_categories::table
            .filter(transaction_categories::id.eq(category_id))
            .filter(transaction_categories::deleted_at.is_null())
            .select(transaction_categories::id)
            .first::<String>(conn)
            .optional()
            .into_storage()?;
        if category_exists.is_none() {
            return failure(
                conn,
                head,
                now,
                INVALID_CATEGORY_ERROR_CODE,
                "template",
                Some(RecurringRepairField::TransactionCategoryId),
            );
        }
    }

    let candidate = NewTransaction {
        id: Some("validation".to_string()),
        description: Some(template.description.clone()),
        amount: template.amount,
        transaction_date: scheduled_local,
        transaction_type: template.transaction_type.clone(),
        transaction_category_id: template.transaction_category_id.clone(),
        notes: template.notes.clone(),
    };
    if candidate.validate().is_err() {
        return failure(conn, head, now, "invalid_template", "template", None);
    }

    Ok(GenerationValidation::Ready {
        schedule,
        template,
        scheduled_local,
    })
}

fn failure(
    conn: &mut SqliteConnection,
    head: &RecurringOccurrenceHeadRow,
    now: NaiveDateTime,
    error_code: &str,
    cause_category: &str,
    repair_field_key: Option<RecurringRepairField>,
) -> Result<GenerationValidation> {
    record_generation_failure(
        conn,
        head,
        now,
        error_code,
        cause_category,
        repair_field_key,
    )
    .map(GenerationValidation::Failed)
}
