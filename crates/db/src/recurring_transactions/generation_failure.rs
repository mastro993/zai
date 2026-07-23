use super::models::RecurringOccurrenceHeadRow;
use crate::domain_alerts::ensure_open_domain_alert;
use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::{domain_alerts, recurring_generation_failures};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use uuid::Uuid;
use zai_core::features::domain_alerts::{AlertInsertOutcome, CommittedOutcome};
use zai_core::features::recurring_transactions::{
    ProcessOneOutcome, RECURRING_GENERATION_FAILURE_PRODUCER_KEY, RecurringRepairField,
    build_generation_failure_alert, occurrence_identity_key,
};

pub(super) fn record(
    conn: &mut SqliteConnection,
    head: &RecurringOccurrenceHeadRow,
    now: NaiveDateTime,
    error_code: &str,
    cause_category: &str,
    repair_field_key: Option<RecurringRepairField>,
) -> Result<CommittedOutcome<ProcessOneOutcome>> {
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
    Ok(if outcome.created_alerts.is_empty() {
        outcome.with_alert_state_changed()
    } else {
        outcome
    })
}
