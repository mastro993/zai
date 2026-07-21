use super::process_test_support::{
    assert_canonical_fulfillment, assert_no_generation_failure, count_canonical, default_seed,
    local, seed_source, setup_dual_services, setup_service,
};
use super::seed::SeedRecurringSource;
use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use std::thread;
use tokio::sync::Barrier;
use zai_core::features::recurring_transactions::{
    ProcessingStopReason, ProcessingWorkBudget, RecurringOccurrenceProcessor,
    RecurringTransactionsService,
};

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn competing_processors_equal_observation_fulfill_once() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, app, daemon, app_repo, _daemon_repo, _lock) =
        setup_dual_services(observed, observed).await;
    assert_eq!(app.identity, "app");
    assert_eq!(daemon.identity, "daemon");
    seed_source(
        &app_repo,
        default_seed("rt-race-eq", "Race Eq", local(2026, 2, 1, 9, 0)),
    )
    .await;

    let start = Arc::new(Barrier::new(3));
    let app_start = Arc::clone(&start);
    let daemon_start = Arc::clone(&start);

    let app_task = tokio::spawn(async move {
        app_start.wait().await;
        app.process_due(observed, ProcessingWorkBudget::occurrences(1), None)
            .await
    });
    let daemon_task = tokio::spawn(async move {
        daemon_start.wait().await;
        daemon
            .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
            .await
    });
    start.wait().await;

    let app_out = match app_task.await.expect("join app") {
        Ok(outcome) => outcome,
        Err(error) if error.is_transient_contention() => {
            panic!("Busy leaked from process_due: {error:?}")
        }
        Err(error) => panic!("app process: {error:?}"),
    };
    let daemon_out = match daemon_task.await.expect("join daemon") {
        Ok(outcome) => outcome,
        Err(error) if error.is_transient_contention() => {
            panic!("Busy leaked from process_due: {error:?}")
        }
        Err(error) => panic!("daemon process: {error:?}"),
    };

    assert_eq!(
        app_out.committed + daemon_out.committed,
        1,
        "exactly one commit across executors; app={app_out:?} daemon={daemon_out:?}"
    );
    assert_canonical_fulfillment(&app_repo, 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn competing_processors_different_observations_loser_reselects() {
    let early = local(2026, 2, 1, 9, 0);
    let late = local(2026, 3, 15, 12, 0);
    let (_db, app, daemon, app_repo, _daemon_repo, _lock) = setup_dual_services(early, late).await;
    seed_source(
        &app_repo,
        SeedRecurringSource {
            id: "rt-race-diff".into(),
            description: "Race Diff".into(),
            lifecycle: "active",
            total_occurrences: None,
            fulfilled_count: 0,
            revision: 1,
            first_scheduled_local: local(2026, 2, 1, 9, 0),
            next_scheduled_local: local(2026, 2, 1, 9, 0),
            next_ordinal: 1,
            amount: 100,
            transaction_type: "expense",
        },
    )
    .await;

    let start = Arc::new(Barrier::new(3));
    let app_start = Arc::clone(&start);
    let daemon_start = Arc::clone(&start);

    let app_task = tokio::spawn(async move {
        app_start.wait().await;
        app.process_due(early, ProcessingWorkBudget::occurrences(1), None)
            .await
    });
    let daemon_task = tokio::spawn(async move {
        daemon_start.wait().await;
        daemon
            .process_due(late, ProcessingWorkBudget::occurrences(2), None)
            .await
    });
    start.wait().await;

    let _ = app_task.await.expect("join").expect("app");
    let _ = daemon_task.await.expect("join").expect("daemon");

    let counts = count_canonical(&app_repo);
    assert_eq!(counts.occurrences, counts.transactions);
    assert_eq!(counts.occurrences, counts.occurrence_alerts);
    assert!(
        (1..=2).contains(&counts.occurrences),
        "late observation may take second month slot"
    );
    assert_eq!(counts.generation_failures, 0);

    let replay = RecurringTransactionsService::new(
        Arc::clone(&app_repo) as Arc<_>,
        Arc::new(super::process_test_support::ManualClock::new(late)),
    );
    let replay_out = replay
        .process_due(late, ProcessingWorkBudget::occurrences(10), None)
        .await
        .expect("replay");
    assert_eq!(replay_out.committed, 0);
    assert_eq!(count_canonical(&app_repo).occurrences, counts.occurrences);
}

#[tokio::test]
async fn retry_after_winner_is_idempotent() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        default_seed("rt-retry", "Retry", local(2026, 2, 1, 9, 0)),
    )
    .await;

    let first = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("first");
    assert_eq!(first.committed, 1);
    let second = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("second");
    assert_eq!(second.committed, 0);
    assert_canonical_fulfillment(&repo, 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn selection_revalidation_after_peer_fulfillment() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, app, daemon, app_repo, _daemon_repo, _lock) =
        setup_dual_services(observed, observed).await;
    seed_source(
        &app_repo,
        default_seed("rt-reval", "Reval", local(2026, 2, 1, 9, 0)),
    )
    .await;

    let start = Arc::new(Barrier::new(3));
    let a = Arc::clone(&start);
    let b = Arc::clone(&start);
    let t1 = tokio::spawn(async move {
        a.wait().await;
        app.process_due(observed, ProcessingWorkBudget::occurrences(1), None)
            .await
    });
    let t2 = tokio::spawn(async move {
        b.wait().await;
        daemon
            .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
            .await
    });
    start.wait().await;
    let _ = t1.await.expect("join").expect("app");
    let _ = t2.await.expect("join").expect("daemon");
    assert_canonical_fulfillment(&app_repo, 1);
}

#[tokio::test(start_paused = true, flavor = "current_thread")]
async fn contention_exhaustion_is_operational_delay_not_source_failure() {
    let observed = local(2026, 2, 10, 12, 0);
    let (temp_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        default_seed("rt-busy", "Busy", local(2026, 2, 1, 9, 0)),
    )
    .await;

    let db_path = temp_db.path().to_string();
    let hold = Arc::new(std::sync::Barrier::new(2));
    let held = Arc::new(std::sync::Barrier::new(2));
    let hold2 = Arc::clone(&hold);
    let held2 = Arc::clone(&held);
    let path = db_path.clone();
    let locker = thread::spawn(move || {
        let mut conn = SqliteConnection::establish(&path).expect("locker");
        conn.batch_execute("PRAGMA busy_timeout = 5000;")
            .expect("timeout");
        conn.immediate_transaction(|conn| {
            diesel::sql_query("SELECT 1").execute(conn)?;
            held2.wait();
            hold2.wait();
            Ok::<_, diesel::result::Error>(())
        })
        .expect("hold");
    });
    held.wait();

    let process = tokio::spawn(async move {
        service
            .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
            .await
    });

    for _ in 0..20 {
        tokio::task::yield_now().await;
        tokio::time::advance(std::time::Duration::from_millis(50)).await;
    }

    let outcome = process.await.expect("join").expect("process");
    assert_eq!(
        outcome.stop_reason,
        ProcessingStopReason::TransientlyDelayed
    );
    assert_eq!(outcome.committed, 0);
    assert_no_generation_failure(&repo);

    hold.wait();
    locker.join().expect("locker");

    let (service2, _) = super::process_test_support::open_service(&db_path, observed);
    let caught_up = service2
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("catch up");
    assert_eq!(caught_up.committed, 1);
    assert_canonical_fulfillment(&repo, 1);
}
