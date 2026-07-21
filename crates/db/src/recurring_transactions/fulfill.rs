use super::fulfill_select::{
    find_next_eligible_due_head, find_occurrence, heal_stale_head_after_existing_occurrence,
};
use super::models::{
    RecurringOccurrenceHeadRow, RecurringOccurrenceRow, RecurringTransactionRow,
    build_recurring_transaction,
};
use super::queries::find_unresolved_failure;
use super::revisions::{find_schedule_revision_at, find_template_revision_at};
use crate::budgets::alerts::{emit_budget_transition_alerts, snapshot_active_budgets};
use crate::budgets::timeline::{BudgetPeriodTimeline, SourceChange};
use crate::domain_alerts::{insert_domain_alert, resolve_domain_alert};
use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::{
    recurring_generation_failures, recurring_occurrence_heads, recurring_occurrences,
    recurring_transactions, transactions,
};
use crate::transactions::models::TransactionRow;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use uuid::Uuid;
use zai_core::Error;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::domain_alerts::{AlertInsertOutcome, CommittedOutcome};
use zai_core::features::recurring_transactions::{
    FulfillmentKind, ProcessOneOutcome, RecurringLifecycle, build_generated_occurrence_alert,
    scheduled_local_at,
};
use zai_core::features::transactions::models::NewTransaction;

#[cfg(test)]
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(test)]
pub static FAIL_AFTER_TRANSACTION_INSERT: AtomicBool = AtomicBool::new(false);

pub fn process_one_due_occurrence(
    conn: &mut SqliteConnection,
    observed_local: NaiveDateTime,
    now: NaiveDateTime,
) -> Result<CommittedOutcome<ProcessOneOutcome>> {
    let Some(head) = find_next_eligible_due_head(conn, observed_local)? else {
        return Ok(CommittedOutcome::with_alert_outcomes(
            ProcessOneOutcome::NoEligibleWork,
            [],
        ));
    };

    if let Some(existing) = find_occurrence(
        conn,
        &head.recurring_transaction_id,
        &head.schedule_revision_id,
        head.next_ordinal,
    )? {
        heal_stale_head_after_existing_occurrence(conn, &head, &existing, now)?;
        return Ok(CommittedOutcome::with_alert_outcomes(
            ProcessOneOutcome::AlreadyFulfilled(existing),
            [],
        ));
    }

    fulfill_generated_occurrence(conn, &head, observed_local, now)
}

fn fulfill_generated_occurrence(
    conn: &mut SqliteConnection,
    head: &RecurringOccurrenceHeadRow,
    observed_local: NaiveDateTime,
    now: NaiveDateTime,
) -> Result<CommittedOutcome<ProcessOneOutcome>> {
    let recurring_row = recurring_transactions::table
        .filter(recurring_transactions::id.eq(&head.recurring_transaction_id))
        .select(RecurringTransactionRow::as_select())
        .first::<RecurringTransactionRow>(conn)
        .into_storage()?;
    let recurring = build_recurring_transaction(recurring_row).map_err(StorageError::from)?;

    if recurring.lifecycle != RecurringLifecycle::Active || recurring.deleted_at.is_some() {
        return Ok(CommittedOutcome::with_alert_outcomes(
            ProcessOneOutcome::NoEligibleWork,
            [],
        ));
    }
    if head.next_scheduled_local > observed_local {
        return Ok(CommittedOutcome::with_alert_outcomes(
            ProcessOneOutcome::NoEligibleWork,
            [],
        ));
    }

    let schedule = find_schedule_revision_at(
        conn,
        &head.recurring_transaction_id,
        head.next_scheduled_local,
    )
    .map_err(StorageError::from)?
    .ok_or_else(|| {
        StorageError::CoreError(Error::Repository(format!(
            "Missing schedule revision for {}",
            head.recurring_transaction_id
        )))
    })?;
    if schedule.id != head.schedule_revision_id {
        return Err(StorageError::CoreError(Error::Repository(
            "Occurrence head schedule revision does not match effective revision".to_string(),
        )));
    }

    let template = find_template_revision_at(
        conn,
        &head.recurring_transaction_id,
        head.next_scheduled_local,
    )
    .map_err(StorageError::from)?
    .ok_or_else(|| {
        StorageError::CoreError(Error::Repository(format!(
            "Missing template revision for {}",
            head.recurring_transaction_id
        )))
    })?;

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

    let fulfillment_position = recurring.fulfilled_count + 1;
    if let Some(total) = recurring.total_occurrences
        && fulfillment_position > total
    {
        return Err(StorageError::CoreError(Error::Repository(
            "Fulfillment would exceed finite total".to_string(),
        )));
    }

    let before = snapshot_active_budgets(conn, now)?;
    let transaction_id = Uuid::new_v4().to_string();
    let new_transaction = NewTransaction {
        id: Some(transaction_id.clone()),
        description: template.description.clone(),
        amount: template.amount,
        transaction_date: scheduled_local,
        transaction_type: template.transaction_type.clone(),
        transaction_category_id: template.transaction_category_id.clone(),
        notes: template.notes.clone(),
    };
    new_transaction
        .validate()
        .map_err(StorageError::CoreError)?;
    let transaction_row: TransactionRow = new_transaction.into();

    diesel::insert_into(transactions::table)
        .values(&transaction_row)
        .execute(conn)
        .into_storage()?;

    #[cfg(test)]
    if FAIL_AFTER_TRANSACTION_INSERT.load(Ordering::SeqCst) {
        return Err(StorageError::CoreError(Error::Repository(
            "Injected fulfillment failure after transaction insert".to_string(),
        )));
    }

    let inserted = transactions::table
        .filter(transactions::id.eq(&transaction_id))
        .first::<TransactionRow>(conn)
        .into_storage()?;

    let alert = build_generated_occurrence_alert(
        &recurring.id,
        &recurring.name,
        &schedule.id,
        head.next_ordinal,
        fulfillment_position,
        &transaction_id,
        recurring.total_occurrences,
    )
    .map_err(StorageError::CoreError)?;
    let alert_outcome = insert_domain_alert(conn, &alert)?;
    let AlertInsertOutcome::Created(created_alert) = alert_outcome else {
        return Err(StorageError::CoreError(Error::Repository(
            "Recurring occurrence alert already exists".to_string(),
        )));
    };
    let recurring_alert_id = created_alert.id.clone();

    diesel::insert_into(recurring_occurrences::table)
        .values(RecurringOccurrenceRow {
            recurring_transaction_id: recurring.id.clone(),
            schedule_revision_id: schedule.id.clone(),
            ordinal: head.next_ordinal,
            scheduled_local,
            template_revision_id: template.id.clone(),
            fulfilled_at: now,
            fulfillment_position,
            transaction_id: transaction_id.clone(),
            fulfillment_kind: FulfillmentKind::Generated.as_str().to_string(),
            recurring_alert_id: Some(recurring_alert_id),
        })
        .execute(conn)
        .into_storage()?;

    let new_fulfilled_count = fulfillment_position;
    let completed = recurring
        .total_occurrences
        .is_some_and(|total| new_fulfilled_count == total);

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
            recurring_transactions::fulfilled_count.eq(new_fulfilled_count),
            recurring_transactions::revision.eq(recurring.revision + 1),
            recurring_transactions::lifecycle.eq(RecurringLifecycle::Completed.as_str()),
            recurring_transactions::lifecycle_changed_at.eq(now),
            recurring_transactions::updated_at.eq(now),
            recurring_transactions::paused_at.eq(None::<NaiveDateTime>),
        ))
        .execute(conn)
        .into_storage()?;
    } else {
        let next_ordinal = head.next_ordinal + 1;
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
    }

    if let Some(failure) =
        find_unresolved_failure(conn, &recurring.id).map_err(StorageError::from)?
        && failure.schedule_revision_id == head.schedule_revision_id
        && failure.ordinal == head.next_ordinal
    {
        diesel::update(
            recurring_generation_failures::table
                .filter(
                    recurring_generation_failures::recurring_transaction_id
                        .eq(&failure.recurring_transaction_id),
                )
                .filter(
                    recurring_generation_failures::schedule_revision_id
                        .eq(&failure.schedule_revision_id),
                )
                .filter(recurring_generation_failures::ordinal.eq(failure.ordinal)),
        )
        .set((
            recurring_generation_failures::resolved_at.eq(now),
            recurring_generation_failures::resolution_kind.eq(Some("fulfilled".to_string())),
        ))
        .execute(conn)
        .into_storage()?;
        resolve_domain_alert(conn, &failure.generation_failure_alert_id)?;
    }

    BudgetPeriodTimeline::reconcile(
        conn,
        SourceChange::Transactions {
            old: vec![],
            new: vec![inserted],
        },
        now,
    )?;
    let after = snapshot_active_budgets(conn, now)?;
    let mut alert_outcomes = vec![AlertInsertOutcome::Created(created_alert)];
    alert_outcomes.extend(emit_budget_transition_alerts(
        conn,
        BudgetAlertMode::Transition,
        &before,
        &after,
    )?);

    let occurrence = find_occurrence(
        conn,
        &recurring.id,
        &head.schedule_revision_id,
        head.next_ordinal,
    )?
    .ok_or_else(|| {
        StorageError::CoreError(Error::Repository(
            "Fulfilled occurrence missing after insert".to_string(),
        ))
    })?;

    Ok(CommittedOutcome::with_alert_outcomes(
        ProcessOneOutcome::Committed(occurrence),
        alert_outcomes,
    ))
}
