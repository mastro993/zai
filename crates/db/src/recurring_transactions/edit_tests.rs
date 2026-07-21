use super::process_test_support::{local, seed_source, setup_service};
use super::seed::SeedRecurringSource;
use zai_core::features::recurring_transactions::{
    EditRecurringSchedule, RecurringMutationOutcome, RecurringTransactionsServiceTrait,
    RenameRecurringTransaction, ScheduleIntervalUnit, ScheduleRule, UNCHANGED_NOT_EDITABLE,
    UNCHANGED_SAME_VALUE,
};

fn base_seed(id: &str, name: &str) -> SeedRecurringSource {
    SeedRecurringSource {
        id: id.into(),
        name: name.into(),
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

#[tokio::test]
async fn rename_succeeds_and_is_idempotent_on_replay() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-rename", "Old name")).await;

    let first = service
        .rename(RenameRecurringTransaction {
            recurring_transaction_id: "rt-rename".into(),
            expected_revision: 1,
            name: "New name".into(),
        })
        .await
        .expect("rename");
    match first {
        RecurringMutationOutcome::Succeeded { document } => {
            assert_eq!(document.recurring_transaction.name, "New name");
            assert_eq!(document.recurring_transaction.revision, 2);
        }
        other => panic!("expected Succeeded, got {other:?}"),
    }

    let replay = service
        .rename(RenameRecurringTransaction {
            recurring_transaction_id: "rt-rename".into(),
            expected_revision: 1,
            name: "New name".into(),
        })
        .await
        .expect("replay");
    assert!(matches!(
        replay,
        RecurringMutationOutcome::AlreadyApplied { .. }
    ));
}

#[tokio::test]
async fn rename_unchanged_when_same_name() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-same", "Same")).await;

    let outcome = service
        .rename(RenameRecurringTransaction {
            recurring_transaction_id: "rt-same".into(),
            expected_revision: 1,
            name: "Same".into(),
        })
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
async fn stopped_source_allows_rename_only() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    let mut seed = base_seed("rt-stopped", "Stopped");
    seed.lifecycle = "stopped";
    seed_source(&repo, seed).await;

    let renamed = service
        .rename(RenameRecurringTransaction {
            recurring_transaction_id: "rt-stopped".into(),
            expected_revision: 1,
            name: "Stopped renamed".into(),
        })
        .await
        .expect("rename stopped");
    assert!(matches!(
        renamed,
        RecurringMutationOutcome::Succeeded { .. }
    ));

    let schedule = service
        .edit_schedule(EditRecurringSchedule {
            recurring_transaction_id: "rt-stopped".into(),
            expected_revision: 2,
            schedule: ScheduleRule::Interval {
                every: 2,
                unit: ScheduleIntervalUnit::Week,
            },
            next_scheduled_local: observed,
        })
        .await
        .expect("schedule blocked");
    match schedule {
        RecurringMutationOutcome::Unchanged { reason, .. } => {
            assert_eq!(reason, UNCHANGED_NOT_EDITABLE);
        }
        other => panic!("expected Unchanged, got {other:?}"),
    }
}
