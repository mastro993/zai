use super::failpoints::{self, FulfillmentFailpoint};
use super::process_test_support::{
    assert_canonical_fulfillment, count_canonical, default_seed, local, reset_failpoints,
    seed_source, setup_service,
};
use super::seed::SeedRecurringSource;
use std::path::PathBuf;
use std::process::Command;
use zai_core::features::recurring_transactions::{
    ProcessingWorkBudget, RecurringOccurrenceProcessor, process_failpoints,
};

fn crash_child_exe() -> PathBuf {
    let mut path = std::env::current_exe().expect("current exe");
    path.pop(); // deps/
    path.pop(); // debug|release/
    path.push("recurring-crash-child");
    path
}

#[tokio::test]
async fn failpoint_before_side_effects_leaves_zero_fulfillment() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        default_seed("rt-fp-before", "Before", local(2026, 2, 1, 9, 0)),
    )
    .await;

    failpoints::arm_error(FulfillmentFailpoint::BeforeSideEffects);
    let err = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect_err("failpoint");
    assert!(err.to_string().contains("BeforeSideEffects") || err.to_string().contains("internal"));
    reset_failpoints();
    assert_canonical_fulfillment(&repo, 0);

    let ok = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("replay");
    assert_eq!(ok.committed, 1);
    assert_canonical_fulfillment(&repo, 1);
}

#[tokio::test]
async fn failpoints_during_each_side_effect_roll_back() {
    let sites = [
        FulfillmentFailpoint::AfterTransactionInsert,
        FulfillmentFailpoint::AfterAlertInsert,
        FulfillmentFailpoint::AfterOccurrenceInsert,
        FulfillmentFailpoint::AfterHeadAdvance,
        FulfillmentFailpoint::AfterBudgetReconcile,
    ];

    for (index, site) in sites.into_iter().enumerate() {
        let observed = local(2026, 2, 10, 12, 0);
        let (_db, service, repo, _lock) = setup_service(observed).await;
        seed_source(
            &repo,
            default_seed(
                &format!("rt-fp-side-{index}"),
                &format!("Side {index}"),
                local(2026, 2, 1, 9, 0),
            ),
        )
        .await;

        failpoints::arm_error(site);
        let err = service
            .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
            .await
            .expect_err("failpoint");
        let message = err.to_string();
        assert!(
            message.contains("Injected")
                || message.contains("internal")
                || format!("{err:?}").contains("Injected"),
            "site {site:?}: {message}"
        );
        reset_failpoints();
        assert_canonical_fulfillment(&repo, 0);

        let ok = service
            .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
            .await
            .expect("replay");
        assert_eq!(ok.committed, 1, "site {site:?}");
        assert_canonical_fulfillment(&repo, 1);
    }
}

#[tokio::test]
async fn failpoint_after_commit_before_reply_leaves_one_canonical_fulfillment() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        default_seed("rt-fp-reply", "Reply", local(2026, 2, 1, 9, 0)),
    )
    .await;

    failpoints::arm_error(FulfillmentFailpoint::AfterCommitBeforeReply);
    let err = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect_err("lost reply");
    assert!(
        err.to_string().contains("after commit")
            || err.to_string().contains("internal")
            || format!("{err:?}").contains("after commit")
    );
    reset_failpoints();

    assert_canonical_fulfillment(&repo, 1);
    let replay = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("replay");
    assert_eq!(replay.committed, 0);
    assert_canonical_fulfillment(&repo, 1);
}

#[tokio::test]
async fn failpoint_between_slices_keeps_completed_occurrence_only() {
    let observed = local(2026, 3, 10, 12, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-fp-slices".into(),
            name: "Slices".into(),
            lifecycle: "active",
            total_occurrences: Some(3),
            fulfilled_count: 0,
            revision: 1,
            first_scheduled_local: local(2026, 1, 1, 9, 0),
            next_scheduled_local: local(2026, 1, 1, 9, 0),
            next_ordinal: 1,
            amount: 100,
            transaction_type: "expense",
        },
    )
    .await;

    process_failpoints::fail_after_commits(1);
    let err = service
        .process_due(observed, ProcessingWorkBudget::occurrences(10), None)
        .await
        .expect_err("between slices");
    assert!(
        err.to_string().contains("between occurrence slices")
            || err.to_string().contains("internal")
    );
    process_failpoints::reset();

    assert_canonical_fulfillment(&repo, 1);

    let resume = service
        .process_due(observed, ProcessingWorkBudget::occurrences(10), None)
        .await
        .expect("resume");
    assert_eq!(resume.committed, 2);
    assert_canonical_fulfillment(&repo, 3);
}

async fn run_subprocess_failpoint(site: FulfillmentFailpoint, expected_after_crash: i64) {
    let observed = local(2026, 2, 10, 12, 0);
    let (temp_db, _service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        default_seed(
            &format!("rt-sub-{}", site as u8),
            &format!("Sub {}", site as u8),
            local(2026, 2, 1, 9, 0),
        ),
    )
    .await;
    let db_path = temp_db.path().to_string();

    let status = Command::new(crash_child_exe())
        .env("ZAI_RECURRING_CRASH_DB", &db_path)
        .env("ZAI_RECURRING_CRASH_SITE", (site as u8).to_string())
        .env(
            "ZAI_RECURRING_CRASH_OBSERVED",
            observed.format("%Y-%m-%d %H:%M:%S").to_string(),
        )
        .status()
        .expect("spawn child");
    assert_eq!(
        status.code(),
        Some(101),
        "child must exit at failpoint, got {status:?}"
    );

    assert_eq!(
        count_canonical(&repo).occurrences,
        expected_after_crash,
        "effects after crash at {site:?}"
    );

    let (service, repo2) = super::process_test_support::open_service(&db_path, observed);
    let replay = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("replay");
    if expected_after_crash == 0 {
        assert_eq!(replay.committed, 1);
        assert_canonical_fulfillment(&repo2, 1);
    } else {
        assert_eq!(replay.committed, 0);
        assert_canonical_fulfillment(&repo2, 1);
    }
}

#[tokio::test]
async fn subprocess_exit_before_commit_leaves_zero_effects() {
    run_subprocess_failpoint(FulfillmentFailpoint::BeforeSideEffects, 0).await;
}

#[tokio::test]
async fn subprocess_exit_after_transaction_insert_leaves_zero_effects() {
    run_subprocess_failpoint(FulfillmentFailpoint::AfterTransactionInsert, 0).await;
}

#[tokio::test]
async fn subprocess_exit_after_alert_insert_leaves_zero_effects() {
    run_subprocess_failpoint(FulfillmentFailpoint::AfterAlertInsert, 0).await;
}

#[tokio::test]
async fn subprocess_exit_after_occurrence_insert_leaves_zero_effects() {
    run_subprocess_failpoint(FulfillmentFailpoint::AfterOccurrenceInsert, 0).await;
}

#[tokio::test]
async fn subprocess_exit_after_head_advance_leaves_zero_effects() {
    run_subprocess_failpoint(FulfillmentFailpoint::AfterHeadAdvance, 0).await;
}

#[tokio::test]
async fn subprocess_exit_after_budget_reconcile_leaves_zero_effects() {
    run_subprocess_failpoint(FulfillmentFailpoint::AfterBudgetReconcile, 0).await;
}

#[tokio::test]
async fn subprocess_exit_after_commit_before_reply_leaves_one_effect() {
    run_subprocess_failpoint(FulfillmentFailpoint::AfterCommitBeforeReply, 1).await;
}

#[tokio::test]
async fn restart_after_between_slices_failure_keeps_complete_first_occurrence() {
    let observed = local(2026, 3, 10, 12, 0);
    let (temp_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-sub-slices".into(),
            name: "SubSlices".into(),
            lifecycle: "active",
            total_occurrences: Some(3),
            fulfilled_count: 0,
            revision: 1,
            first_scheduled_local: local(2026, 1, 1, 9, 0),
            next_scheduled_local: local(2026, 1, 1, 9, 0),
            next_ordinal: 1,
            amount: 100,
            transaction_type: "expense",
        },
    )
    .await;

    process_failpoints::fail_after_commits(1);
    let _ = service
        .process_due(observed, ProcessingWorkBudget::occurrences(10), None)
        .await
        .expect_err("between slices");
    process_failpoints::reset();
    assert_canonical_fulfillment(&repo, 1);

    let db_path = temp_db.path().to_string();
    let (service2, repo2) = super::process_test_support::open_service(&db_path, observed);
    let resume = service2
        .process_due(observed, ProcessingWorkBudget::occurrences(10), None)
        .await
        .expect("resume after restart");
    assert_eq!(resume.committed, 2);
    assert_canonical_fulfillment(&repo2, 3);
}
