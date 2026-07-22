use super::lifecycle_test_support::{base_seed, lifecycle_update};
use super::process_test_support::{local, seed_source, setup_service};
use super::seed::SeedRecurringSource;
use zai_core::features::recurring_transactions::{
    MAX_BULK_SELECTION, RecurringBulkAction, RecurringBulkItem, RecurringBulkItemOutcomeKind,
    RecurringBulkRequest, RecurringLifecycle, RecurringLifecycleOutcome,
    RecurringTransactionsServiceTrait,
};

fn bulk_item(id: &str, revision: i32) -> RecurringBulkItem {
    RecurringBulkItem {
        recurring_transaction_id: id.into(),
        expected_revision: revision,
    }
}

fn future_seed(id: &str, description: &str) -> SeedRecurringSource {
    let mut seed = base_seed(id, description);
    seed.first_scheduled_local = local(2026, 2, 1, 9, 0);
    seed.next_scheduled_local = local(2026, 2, 1, 9, 0);
    seed
}

#[tokio::test]
async fn list_matching_ids_returns_visible_sources() {
    let observed = local(2026, 2, 1, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-a", "Alpha")).await;
    seed_source(&repo, base_seed("rt-b", "Beta")).await;
    service
        .delete(lifecycle_update("rt-b", 1))
        .await
        .expect("delete");

    let matching = service.list_matching_ids().await.expect("ids");
    assert_eq!(
        matching
            .items
            .iter()
            .map(|item| item.recurring_transaction_id.as_str())
            .collect::<Vec<_>>(),
        vec!["rt-a"]
    );
}

#[tokio::test]
async fn preflight_rejects_over_500() {
    let observed = local(2026, 2, 1, 10, 0);
    let (_db, service, _repo, _clock, _lock) = setup_service(observed).await;
    let items = (0..=MAX_BULK_SELECTION)
        .map(|index| bulk_item(&format!("rt-{index}"), 1))
        .collect();
    let error = service
        .preflight_bulk(RecurringBulkRequest {
            action: RecurringBulkAction::Pause,
            items,
        })
        .await
        .expect_err("limit");
    assert!(error.to_string().contains("500"));
}

#[tokio::test]
async fn preflight_reports_mixed_eligibility() {
    let observed = local(2026, 1, 1, 8, 0);
    let (_db, service, repo, clock, _lock) = setup_service(observed).await;
    seed_source(&repo, future_seed("rt-active", "Active")).await;
    seed_source(&repo, future_seed("rt-paused", "Paused")).await;
    let paused = service
        .pause(lifecycle_update("rt-paused", 1))
        .await
        .expect("pause");
    let paused_revision = match paused {
        RecurringLifecycleOutcome::Succeeded { document } => {
            document.recurring_transaction.revision
        }
        other => panic!("expected pause Succeeded, got {other:?}"),
    };

    clock.set(local(2026, 3, 15, 10, 0));
    let active_doc = service.get_document("rt-active").await.expect("active");
    let preflight = service
        .preflight_bulk(RecurringBulkRequest {
            action: RecurringBulkAction::Pause,
            items: vec![
                bulk_item("rt-active", active_doc.recurring_transaction.revision),
                bulk_item("rt-paused", paused_revision),
            ],
        })
        .await
        .expect("preflight");

    assert_eq!(preflight.selected, 2);
    assert_eq!(preflight.eligible, 1);
    assert_eq!(preflight.unchanged, 1);
    assert_eq!(preflight.lifecycle.active, 1);
    assert_eq!(preflight.lifecycle.paused, 1);
    assert!(preflight.due_catch_up >= 1);
    assert_eq!(
        preflight.eligible_items[0].recurring_transaction_id,
        "rt-active"
    );
    assert_eq!(
        preflight.unchanged_items[0].recurring_transaction_id,
        "rt-paused"
    );
}

#[tokio::test]
async fn execute_partial_success_keeps_unchanged_selected_semantics() {
    let observed = local(2026, 1, 1, 8, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(&repo, future_seed("rt-one", "One")).await;
    seed_source(&repo, future_seed("rt-two", "Two")).await;
    let paused = service
        .pause(lifecycle_update("rt-two", 1))
        .await
        .expect("pause two");
    let paused_revision = match paused {
        RecurringLifecycleOutcome::Succeeded { document } => {
            document.recurring_transaction.revision
        }
        other => panic!("expected pause Succeeded, got {other:?}"),
    };
    let one_doc = service.get_document("rt-one").await.expect("one");

    let result = service
        .execute_bulk(RecurringBulkRequest {
            action: RecurringBulkAction::Pause,
            items: vec![
                bulk_item("rt-one", one_doc.recurring_transaction.revision),
                bulk_item("rt-two", paused_revision),
            ],
        })
        .await
        .expect("execute");

    assert_eq!(result.succeeded, 1);
    assert_eq!(result.unchanged, 1);
    assert_eq!(result.failed, 0);
    assert_eq!(
        result.results[0].outcome,
        RecurringBulkItemOutcomeKind::Succeeded
    );
    assert_eq!(
        result.results[1].outcome,
        RecurringBulkItemOutcomeKind::Unchanged
    );

    let one = service.get_document("rt-one").await.expect("one");
    assert_eq!(
        one.recurring_transaction.lifecycle,
        RecurringLifecycle::Paused
    );
    let two = service.get_document("rt-two").await.expect("two");
    assert_eq!(
        two.recurring_transaction.lifecycle,
        RecurringLifecycle::Paused
    );
}
