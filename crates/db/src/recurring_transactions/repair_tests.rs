use super::process_test_support::{local, seed_source, setup_service};
use super::seed::SeedRecurringSource;
use crate::schema::{
    recurring_generation_failures, recurring_template_revisions, transaction_categories,
};
use diesel::prelude::*;
use zai_core::features::recurring_transactions::{
    RecurringRecoveryOutcome, RecurringRepairField, RecurringTemplateInput,
    RecurringTransactionsServiceTrait, RepairRecurringGenerationFailure,
    RetryRecurringGenerationFailure, UNCHANGED_REPAIR_REQUIRED, process_failpoints,
};

fn base_seed(id: &str, description: &str) -> SeedRecurringSource {
    SeedRecurringSource {
        id: id.into(),
        description: description.into(),
        lifecycle: "active",
        total_occurrences: Some(12),
        fulfilled_count: 0,
        revision: 1,
        first_scheduled_local: local(2026, 1, 1, 9, 0),
        next_scheduled_local: local(2026, 1, 1, 9, 0),
        next_ordinal: 1,
        amount: 1000,
        transaction_type: "expense",
    }
}

async fn seed_open_failure(
    repo: &super::RecurringTransactionsRepository,
    recurring_id: &str,
    schedule_id: &str,
    repair_field_key: Option<RecurringRepairField>,
    observed: chrono::NaiveDateTime,
) {
    let writer = repo.writer().clone();
    let recurring_id = recurring_id.to_string();
    let schedule_id = schedule_id.to_string();
    let repair_field_key = repair_field_key.map(RecurringRepairField::storage_key);
    writer
        .exec(move |conn| {
            diesel::sql_query(
                "INSERT INTO domain_alerts (id, producer_key, occurrence_key, severity, title, body, created_at, updated_at) \
                 VALUES ('alert-repair', 'recurring.generation_failure', 'rt-repair|sched|1', 'critical', 'Blocked', 'Needs repair', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            )
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            diesel::insert_into(recurring_generation_failures::table)
                .values((
                    recurring_generation_failures::recurring_transaction_id.eq(&recurring_id),
                    recurring_generation_failures::schedule_revision_id.eq(&schedule_id),
                    recurring_generation_failures::ordinal.eq(1),
                    recurring_generation_failures::error_code.eq("invalid_category"),
                    recurring_generation_failures::cause_category.eq("template"),
                    recurring_generation_failures::repair_field_key.eq(repair_field_key),
                    recurring_generation_failures::correlation_id.eq("corr-repair"),
                    recurring_generation_failures::failed_scheduled_local
                        .eq(local(2026, 1, 1, 9, 0)),
                    recurring_generation_failures::first_failed_at.eq(observed),
                    recurring_generation_failures::last_failed_at.eq(observed),
                    recurring_generation_failures::attempt_count.eq(1),
                    recurring_generation_failures::generation_failure_alert_id.eq("alert-repair"),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("seed failure");
}

#[tokio::test]
async fn retry_now_rejects_when_known_repair_required() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (schedule_id, _) = seed_source(&repo, base_seed("rt-repair", "Repair")).await;
    seed_open_failure(
        &repo,
        "rt-repair",
        &schedule_id,
        Some(RecurringRepairField::TransactionCategoryId),
        observed,
    )
    .await;

    let outcome = service
        .retry_generation(RetryRecurringGenerationFailure {
            recurring_transaction_id: "rt-repair".into(),
            expected_revision: 1,
        })
        .await
        .expect("retry");
    match outcome {
        RecurringRecoveryOutcome::Unchanged { reason, .. } => {
            assert_eq!(reason, UNCHANGED_REPAIR_REQUIRED);
        }
        other => panic!("expected Unchanged, got {other:?}"),
    }
}

#[tokio::test]
async fn repair_marks_failure_and_keeps_template_change_after_retry_wake() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (schedule_id, _) = seed_source(&repo, base_seed("rt-repair-amt", "Repair amt")).await;
    seed_open_failure(
        &repo,
        "rt-repair-amt",
        &schedule_id,
        Some(RecurringRepairField::Amount),
        observed,
    )
    .await;

    let before = service.get_document("rt-repair-amt").await.expect("before");
    let outcome = service
        .repair_and_retry(RepairRecurringGenerationFailure {
            recurring_transaction_id: "rt-repair-amt".into(),
            expected_revision: before.recurring_transaction.revision,
            repair_field_key: RecurringRepairField::Amount,
            template: RecurringTemplateInput {
                description: before.template.description.clone(),
                amount: 2500,
                transaction_type: before.template.transaction_type.clone(),
                transaction_category_id: before.template.transaction_category_id.clone(),
                notes: before.template.notes.clone(),
            },
        })
        .await
        .expect("repair");
    assert!(matches!(
        outcome,
        RecurringRecoveryOutcome::Succeeded { .. }
    ));

    let after = service.get_document("rt-repair-amt").await.expect("after");
    assert_eq!(after.template.amount, 2500);
    if let Some(failure) = after.failures.unresolved {
        assert!(failure.repaired_at.is_some());
        assert_eq!(failure.repair_revision, Some(2));
    } else {
        let history = &after.failures.history.items;
        assert!(!history.is_empty());
        assert!(history[0].repaired_at.is_some());
        assert_eq!(history[0].repair_revision, Some(2));
        assert!(history[0].resolved_at.is_some());
        assert!(!after.occurrence_summary.needs_attention);
    }
}

#[tokio::test]
async fn repair_remains_durable_when_retry_fails_after_commit() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (schedule_id, _) = seed_source(&repo, base_seed("rt-repair-durable", "Durable")).await;
    seed_open_failure(
        &repo,
        "rt-repair-durable",
        &schedule_id,
        Some(RecurringRepairField::Amount),
        observed,
    )
    .await;

    let before = service
        .get_document("rt-repair-durable")
        .await
        .expect("before");
    process_failpoints::fail_after_commits(1);
    let result = service
        .repair_and_retry(RepairRecurringGenerationFailure {
            recurring_transaction_id: "rt-repair-durable".into(),
            expected_revision: before.recurring_transaction.revision,
            repair_field_key: RecurringRepairField::Amount,
            template: RecurringTemplateInput {
                description: before.template.description.clone(),
                amount: 2500,
                transaction_type: before.template.transaction_type.clone(),
                transaction_category_id: before.template.transaction_category_id.clone(),
                notes: before.template.notes.clone(),
            },
        })
        .await;
    process_failpoints::reset();

    assert!(matches!(
        result.expect("repair remains successful"),
        RecurringRecoveryOutcome::Succeeded { .. }
    ));
    let after = service
        .get_document("rt-repair-durable")
        .await
        .expect("after");
    assert_eq!(after.template.amount, 2500);
    assert_eq!(after.links.occurrences.items.len(), 1);
    assert!(after.failures.unresolved.is_none());
    assert_eq!(after.failures.history.items.len(), 1);
}

#[tokio::test]
async fn diagnostics_exclude_financial_and_zone_fields() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (schedule_id, _) = seed_source(&repo, base_seed("rt-diag", "Secret Rent 999")).await;
    seed_open_failure(&repo, "rt-diag", &schedule_id, None, observed).await;

    let diagnostics = service
        .generation_failure_diagnostics("rt-diag")
        .await
        .expect("diagnostics");
    let encoded = serde_json::to_string(&diagnostics).expect("json");
    assert!(!encoded.contains("Secret Rent"));
    assert!(!encoded.contains("999"));
    assert!(!encoded.to_lowercase().contains("zone"));
    assert_eq!(diagnostics.correlation_id, "corr-repair");
    assert_eq!(diagnostics.typed_state, "needs_attention");
    assert!(!diagnostics.schema_version.is_empty());
}

#[tokio::test]
async fn document_exposes_waiting_count_for_blocked_source() {
    let observed = local(2026, 4, 21, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let mut seed = base_seed("rt-wait", "Waiting");
    seed.first_scheduled_local = local(2026, 1, 21, 10, 0);
    seed.next_scheduled_local = local(2026, 1, 21, 10, 0);
    let (schedule_id, _) = seed_source(&repo, seed).await;
    seed_open_failure(
        &repo,
        "rt-wait",
        &schedule_id,
        Some(RecurringRepairField::Amount),
        observed,
    )
    .await;

    let document = service.get_document("rt-wait").await.expect("doc");
    assert!(document.occurrence_summary.needs_attention);
    assert_eq!(document.failures.waiting_count, 3);
}

#[tokio::test]
async fn category_repair_rejects_missing_category() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (schedule_id, _) = seed_source(&repo, base_seed("rt-cat", "Category")).await;
    seed_open_failure(
        &repo,
        "rt-cat",
        &schedule_id,
        Some(RecurringRepairField::TransactionCategoryId),
        observed,
    )
    .await;
    let before = service.get_document("rt-cat").await.expect("before");
    let error = service
        .repair_and_retry(RepairRecurringGenerationFailure {
            recurring_transaction_id: "rt-cat".into(),
            expected_revision: before.recurring_transaction.revision,
            repair_field_key: RecurringRepairField::TransactionCategoryId,
            template: RecurringTemplateInput {
                description: before.template.description.clone(),
                amount: before.template.amount,
                transaction_type: before.template.transaction_type.clone(),
                transaction_category_id: Some("missing-category".into()),
                notes: before.template.notes.clone(),
            },
        })
        .await
        .expect_err("missing category");
    assert!(error.to_string().contains("Repair category does not exist"));

    let _ = (
        transaction_categories::table,
        recurring_template_revisions::table,
    );
}
