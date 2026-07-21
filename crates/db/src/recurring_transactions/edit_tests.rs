use super::process_test_support::{local, seed_source, setup_service};
use super::seed::SeedRecurringSource;
use zai_core::features::recurring_transactions::{
    RecurringMutationOutcome, RecurringTemplateInput, RecurringTransactionDocument,
    RecurringTransactionsServiceTrait, ScheduleIntervalUnit, ScheduleRule, UNCHANGED_NOT_EDITABLE,
    UNCHANGED_SAME_VALUE, UpdateRecurringTransaction,
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

fn update_from_document(document: &RecurringTransactionDocument) -> UpdateRecurringTransaction {
    UpdateRecurringTransaction {
        recurring_transaction_id: document.recurring_transaction.id.clone(),
        expected_revision: document.recurring_transaction.revision,
        schedule: document.schedule.rule.clone(),
        next_scheduled_local: document
            .occurrence_summary
            .next_scheduled_local
            .unwrap_or(document.schedule.first_scheduled_local),
        total_occurrences: document.recurring_transaction.total_occurrences,
        template: RecurringTemplateInput {
            description: document.template.description.clone(),
            amount: document.template.amount,
            transaction_type: document.template.transaction_type.clone(),
            transaction_category_id: document.template.transaction_category_id.clone(),
            notes: document.template.notes.clone(),
        },
    }
}

#[tokio::test]
async fn template_description_update_is_idempotent_on_replay() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-description", "Old description")).await;
    let before = service.get_document("rt-description").await.expect("doc");

    let mut first_input = update_from_document(&before);
    first_input.template.description = "New description".into();
    let first = service
        .update(first_input.clone())
        .await
        .expect("update description");
    match first {
        RecurringMutationOutcome::Succeeded { document } => {
            assert_eq!(document.template.description, "New description");
            assert_eq!(document.recurring_transaction.revision, 2);
        }
        other => panic!("expected Succeeded, got {other:?}"),
    }

    let mut replay = first_input;
    replay.expected_revision = 1;
    let replay = service.update(replay).await.expect("replay");
    assert!(matches!(
        replay,
        RecurringMutationOutcome::AlreadyApplied { .. }
    ));
}

#[tokio::test]
async fn template_description_unchanged_when_same_value() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-same", "Same")).await;
    let before = service.get_document("rt-same").await.expect("doc");

    let outcome = service
        .update(update_from_document(&before))
        .await
        .expect("same");
    match outcome {
        RecurringMutationOutcome::Unchanged { reason, .. } => {
            assert_eq!(reason, UNCHANGED_SAME_VALUE);
        }
        other => panic!("expected Unchanged, got {other:?}"),
    }
}

#[tokio::test]
async fn stopped_source_rejects_configuration_edits() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    let mut seed = base_seed("rt-stopped", "Stopped");
    seed.lifecycle = "stopped";
    seed_source(&repo, seed).await;
    let before = service.get_document("rt-stopped").await.expect("doc");

    let mut schedule = update_from_document(&before);
    schedule.schedule = ScheduleRule::Interval {
        every: 2,
        unit: ScheduleIntervalUnit::Week,
    };
    schedule.next_scheduled_local = observed;
    let schedule = service.update(schedule).await.expect("schedule blocked");
    match schedule {
        RecurringMutationOutcome::Unchanged { reason, .. } => {
            assert_eq!(reason, UNCHANGED_NOT_EDITABLE);
        }
        other => panic!("expected Unchanged, got {other:?}"),
    }
}
