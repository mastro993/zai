use super::process_test_support::{
    assert_canonical_fulfillment, count_canonical, default_seed, local, process_until_caught_up,
    seed_source, setup_service,
};
use super::revisions::{find_schedule_revision_at, find_template_revision_at};
use crate::connection::get_connection;
use zai_core::features::recurring_transactions::{
    ProcessingWorkBudget, RecurringBulkAction, RecurringBulkItem, RecurringBulkRequest,
    RecurringOccurrenceProcessor, RecurringTemplateInput, RecurringTransactionsServiceTrait,
    ScheduleIntervalUnit, ScheduleRule, UpdateRecurringTransaction,
};

const RELEASE_EVIDENCE_SEED: u64 = 277;

fn next_seed(seed: &mut u64) -> u64 {
    *seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
    *seed
}

#[tokio::test]
async fn seeded_generated_sources_remain_exactly_once_after_replay() {
    let observed = local(2026, 7, 31, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let mut seed = RELEASE_EVIDENCE_SEED;
    let source_count = 8;
    let occurrences_per_source = 3;

    for index in 0..source_count {
        let first = local(
            2025,
            1 + (next_seed(&mut seed) % 3) as u32,
            1 + (next_seed(&mut seed) % 4) as u32,
            9,
            0,
        );
        let mut source = default_seed(
            &format!("release-evidence-{index}"),
            &format!("Release evidence {index}"),
            first,
        );
        source.total_occurrences = Some(occurrences_per_source);
        source.amount = 100 + (next_seed(&mut seed) % 900) as i32;
        seed_source(&repo, source).await;
    }

    let expected = (source_count * occurrences_per_source) as i64;
    let first = process_until_caught_up(&service, observed, expected as usize + 1)
        .await
        .expect("generated processing");
    assert_eq!(first.committed, expected as u32);
    let before_replay = count_canonical(&repo);

    let replay = service
        .process_due(observed, ProcessingWorkBudget::occurrences(100), None)
        .await
        .expect("replay");
    assert_eq!(replay.committed, 0);
    assert_eq!(replay.already_fulfilled, 0);
    assert!(!replay.more_due_remaining);
    assert_eq!(count_canonical(&repo), before_replay);
    assert_canonical_fulfillment(&repo, expected);
}

#[tokio::test]
async fn generated_revision_boundaries_select_one_half_open_revision() {
    let observed = local(2026, 7, 31, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let source = default_seed(
        "release-revision",
        "Revision evidence",
        local(2026, 7, 1, 9, 0),
    );
    seed_source(&repo, source).await;

    let document = service
        .get_document("release-revision")
        .await
        .expect("document");
    let mut update = UpdateRecurringTransaction {
        recurring_transaction_id: document.recurring_transaction.id.clone(),
        expected_revision: document.recurring_transaction.revision,
        schedule: ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Week,
        },
        next_scheduled_local: local(2026, 8, 15, 9, 0),
        total_occurrences: document.recurring_transaction.total_occurrences,
        template: RecurringTemplateInput {
            description: document.template.description.clone(),
            amount: document.template.amount,
            transaction_type: document.template.transaction_type.clone(),
            transaction_category_id: document.template.transaction_category_id.clone(),
            notes: document.template.notes.clone(),
        },
    };
    update.template.description = "Revision evidence updated".to_string();
    let outcome = service.update(update).await.expect("revision update");
    assert!(matches!(
        outcome,
        zai_core::features::recurring_transactions::RecurringMutationOutcome::Succeeded { .. }
    ));

    let pool = repo.pool().clone();
    let (old, new, template) = tokio::task::spawn_blocking(move || {
        let mut connection = get_connection(&pool).expect("connection");
        let boundary = local(2026, 8, 15, 9, 0);
        let old = find_schedule_revision_at(
            &mut connection,
            "release-revision",
            boundary - chrono::Duration::minutes(1),
        )
        .expect("old revision")
        .expect("old revision exists");
        let new = find_schedule_revision_at(&mut connection, "release-revision", boundary)
            .expect("new revision")
            .expect("new revision exists");
        let template = find_template_revision_at(&mut connection, "release-revision", boundary)
            .expect("template revision")
            .expect("template revision exists");
        (old, new, template)
    })
    .await
    .expect("join");

    assert_ne!(old.id, new.id);
    assert_eq!(new.effective_from_local, local(2026, 8, 15, 9, 0));
    assert_eq!(new.effective_until_local, None);
    assert_eq!(old.effective_until_local, Some(local(2026, 8, 15, 9, 0)));
    assert_eq!(template.description, "Revision evidence updated");
}

#[tokio::test]
async fn bulk_partial_commit_keeps_each_generated_result_partitioned() {
    let observed = local(2026, 7, 31, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    for index in 0..6 {
        let mut source = default_seed(
            &format!("release-bulk-{index}"),
            &format!("Release bulk {index}"),
            local(2026, 8, 15, 9, 0),
        );
        if index % 2 == 1 {
            source.lifecycle = "active";
        }
        seed_source(&repo, source).await;
    }

    for index in (1..6).step_by(2) {
        service
            .pause(
                zai_core::features::recurring_transactions::RecurringLifecycleUpdate {
                    recurring_transaction_id: format!("release-bulk-{index}"),
                    expected_revision: 1,
                },
            )
            .await
            .expect("pause generated source");
    }

    let result = service
        .execute_bulk(RecurringBulkRequest {
            action: RecurringBulkAction::Pause,
            items: (0..6)
                .map(|index| RecurringBulkItem {
                    recurring_transaction_id: format!("release-bulk-{index}"),
                    expected_revision: if index % 2 == 1 { 2 } else { 1 },
                })
                .collect(),
        })
        .await
        .expect("bulk result");

    assert_eq!(result.succeeded, 3);
    assert_eq!(result.unchanged, 3);
    assert_eq!(result.failed, 0);
    assert_eq!(result.results.len(), 6);
    assert_eq!(
        result.succeeded + result.unchanged + result.failed,
        result.results.len() as i32
    );
    for index in 0..6 {
        let document = service
            .get_document(&format!("release-bulk-{index}"))
            .await
            .expect("bulk document");
        if index % 2 == 0 {
            assert!(matches!(
                document.recurring_transaction.lifecycle,
                zai_core::features::recurring_transactions::RecurringLifecycle::Paused
            ));
        }
    }
}
