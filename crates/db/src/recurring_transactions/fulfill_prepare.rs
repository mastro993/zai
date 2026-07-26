use super::models::RecurringOccurrenceHeadRow;
use super::revisions::{find_schedule_revision_at, find_template_revision_at};
use crate::domain_alerts::ensure_open_domain_alert;
use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::{domain_alerts, recurring_generation_failures, transaction_categories};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use uuid::Uuid;
use zai_core::Error;
use zai_core::features::domain_alerts::{AlertInsertOutcome, CommittedOutcome};
use zai_core::features::recurring_transactions::{
    INVALID_CATEGORY_ERROR_CODE, ProcessOneOutcome, RECURRING_GENERATION_FAILURE_PRODUCER_KEY,
    RecurringRepairField, RecurringScheduleRevision, RecurringTemplateRevision,
    build_generation_failure_alert, occurrence_identity_key, scheduled_local_at,
};
use zai_core::features::transactions::models::NewTransaction;

pub(super) enum FulfillmentPreparation {
    Ready {
        schedule: RecurringScheduleRevision,
        template: RecurringTemplateRevision,
        scheduled_local: NaiveDateTime,
    },
    Failed(CommittedOutcome<ProcessOneOutcome>),
}

pub(super) fn prepare_generated_occurrence(
    conn: &mut SqliteConnection,
    head: &RecurringOccurrenceHeadRow,
    now: NaiveDateTime,
) -> Result<FulfillmentPreparation> {
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
        return failed(
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
            return failed(
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
        return failed(conn, head, now, "invalid_template", "template", None);
    }

    Ok(FulfillmentPreparation::Ready {
        schedule,
        template,
        scheduled_local,
    })
}

fn failed(
    conn: &mut SqliteConnection,
    head: &RecurringOccurrenceHeadRow,
    now: NaiveDateTime,
    error_code: &str,
    cause_category: &str,
    repair_field_key: Option<RecurringRepairField>,
) -> Result<FulfillmentPreparation> {
    let alert = build_generation_failure_alert(
        &head.recurring_transaction_id,
        &head.schedule_revision_id,
        head.next_ordinal,
    )
    .map_err(StorageError::CoreError)?;
    let alert_outcome = ensure_open_domain_alert(conn, &alert)?;
    let alert_id = match &alert_outcome {
        AlertInsertOutcome::Created(alert) => alert.id.clone(),
        AlertInsertOutcome::AlreadyExists => domain_alerts::table
            .filter(domain_alerts::producer_key.eq(RECURRING_GENERATION_FAILURE_PRODUCER_KEY))
            .filter(domain_alerts::occurrence_key.eq(occurrence_identity_key(
                &head.recurring_transaction_id,
                &head.schedule_revision_id,
                head.next_ordinal,
            )))
            .select(domain_alerts::id)
            .first::<String>(conn)
            .into_storage()?,
    };

    let existing = recurring_generation_failures::table
        .filter(
            recurring_generation_failures::recurring_transaction_id
                .eq(&head.recurring_transaction_id),
        )
        .filter(recurring_generation_failures::schedule_revision_id.eq(&head.schedule_revision_id))
        .filter(recurring_generation_failures::ordinal.eq(head.next_ordinal))
        .select(recurring_generation_failures::attempt_count)
        .first::<i32>(conn)
        .optional()
        .into_storage()?;

    if let Some(attempt_count) = existing {
        diesel::update(
            recurring_generation_failures::table
                .filter(
                    recurring_generation_failures::recurring_transaction_id
                        .eq(&head.recurring_transaction_id),
                )
                .filter(
                    recurring_generation_failures::schedule_revision_id
                        .eq(&head.schedule_revision_id),
                )
                .filter(recurring_generation_failures::ordinal.eq(head.next_ordinal)),
        )
        .set((
            recurring_generation_failures::error_code.eq(error_code),
            recurring_generation_failures::cause_category.eq(cause_category),
            recurring_generation_failures::repair_field_key
                .eq(repair_field_key.map(RecurringRepairField::storage_key)),
            recurring_generation_failures::last_failed_at.eq(now),
            recurring_generation_failures::attempt_count.eq(attempt_count + 1),
            recurring_generation_failures::repaired_at.eq(None::<NaiveDateTime>),
            recurring_generation_failures::repair_revision.eq(None::<i32>),
            recurring_generation_failures::resolved_at.eq(None::<NaiveDateTime>),
            recurring_generation_failures::resolution_kind.eq(None::<String>),
            recurring_generation_failures::generation_failure_alert_id.eq(alert_id),
        ))
        .execute(conn)
        .into_storage()?;
    } else {
        diesel::insert_into(recurring_generation_failures::table)
            .values((
                recurring_generation_failures::recurring_transaction_id
                    .eq(&head.recurring_transaction_id),
                recurring_generation_failures::schedule_revision_id.eq(&head.schedule_revision_id),
                recurring_generation_failures::ordinal.eq(head.next_ordinal),
                recurring_generation_failures::error_code.eq(error_code),
                recurring_generation_failures::cause_category.eq(cause_category),
                recurring_generation_failures::repair_field_key
                    .eq(repair_field_key.map(RecurringRepairField::storage_key)),
                recurring_generation_failures::correlation_id.eq(Uuid::new_v4().to_string()),
                recurring_generation_failures::failed_scheduled_local.eq(head.next_scheduled_local),
                recurring_generation_failures::first_failed_at.eq(now),
                recurring_generation_failures::last_failed_at.eq(now),
                recurring_generation_failures::attempt_count.eq(1),
                recurring_generation_failures::repaired_at.eq(None::<NaiveDateTime>),
                recurring_generation_failures::repair_revision.eq(None::<i32>),
                recurring_generation_failures::resolved_at.eq(None::<NaiveDateTime>),
                recurring_generation_failures::resolution_kind.eq(None::<String>),
                recurring_generation_failures::generation_failure_alert_id.eq(alert_id),
            ))
            .execute(conn)
            .into_storage()?;
    }

    let outcome =
        CommittedOutcome::with_alert_outcomes(ProcessOneOutcome::GenerationFailed, [alert_outcome]);
    let outcome = if outcome.created_alerts.is_empty() {
        outcome.with_alert_state_changed()
    } else {
        outcome
    };
    Ok(FulfillmentPreparation::Failed(outcome))
}
