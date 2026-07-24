use super::process_test_support::{
    assert_canonical_fulfillment, default_seed, local, seed_source, setup_service,
};
use super::seed::SeedRecurringSource;
use crate::schema::recurring_transactions;
use diesel::prelude::*;
use std::sync::atomic::{AtomicBool, Ordering};
use zai_core::features::recurring_transactions::{
    ProcessingStopReason, ProcessingWorkBudget, RecurringOccurrenceProcessor,
};

#[tokio::test]
async fn synthetic_pause_before_process_yields_no_fulfillment() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        default_seed("rt-paused", "Paused", local(2026, 2, 1, 9, 0)),
    )
    .await;
    let writer = repo.writer().clone();
    writer
        .exec(|conn| {
            diesel::update(recurring_transactions::table)
                .filter(recurring_transactions::id.eq("rt-paused"))
                .set((
                    recurring_transactions::lifecycle.eq("paused"),
                    recurring_transactions::paused_at.eq(Some(chrono::Utc::now().naive_utc())),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("pause");

    let outcome = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("process");
    assert_eq!(outcome.committed, 0);
    assert_eq!(outcome.stop_reason, ProcessingStopReason::CaughtUp);
    assert_canonical_fulfillment(&repo, 0);
}

#[tokio::test]
async fn synthetic_stop_before_process_yields_no_fulfillment() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        default_seed("rt-stopped", "Stopped", local(2026, 2, 1, 9, 0)),
    )
    .await;
    let writer = repo.writer().clone();
    writer
        .exec(|conn| {
            diesel::update(recurring_transactions::table)
                .filter(recurring_transactions::id.eq("rt-stopped"))
                .set(recurring_transactions::lifecycle.eq("stopped"))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("stop");

    let outcome = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("process");
    assert_eq!(outcome.committed, 0);
    assert_canonical_fulfillment(&repo, 0);
}

#[tokio::test]
async fn synthetic_edit_revalidation_rejects_stale_head_schedule() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        default_seed("rt-edit", "Edit", local(2026, 2, 1, 9, 0)),
    )
    .await;

    // Head scheduled local no longer matches schedule calculation.
    let writer = repo.writer().clone();
    writer
        .exec(move |conn| {
            diesel::sql_query(
                "UPDATE recurring_occurrence_heads \
                 SET next_scheduled_local = '2026-02-01 10:00:00' \
                 WHERE recurring_transaction_id = 'rt-edit'",
            )
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("edit head");

    let err = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect_err("revalidation");
    let message = err.to_string();
    assert!(
        message.contains("scheduled local")
            || message.contains("internal")
            || format!("{err:?}").contains("scheduled"),
        "unexpected error: {message}"
    );
    assert_canonical_fulfillment(&repo, 0);
}

#[tokio::test]
async fn synthetic_repair_clear_allows_fulfillment() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (schedule_id, _) = seed_source(
        &repo,
        default_seed("rt-repair", "Repair", local(2026, 2, 1, 9, 0)),
    )
    .await;

    let writer = repo.writer().clone();
    let schedule_for_failure = schedule_id.clone();
    writer
        .exec(move |conn| {
            diesel::sql_query(
                "INSERT INTO domain_alerts (id, producer_key, occurrence_key, severity, title, body, created_at, updated_at) \
                 VALUES ('alert-block', 'recurring.generation_failure', 'rt-repair|sched|1', 'critical', 'Blocked', 'Needs repair', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            )
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            diesel::sql_query(format!(
                "INSERT INTO recurring_generation_failures (\
                    recurring_transaction_id, schedule_revision_id, ordinal, error_code, cause_category, \
                    correlation_id, failed_scheduled_local, first_failed_at, last_failed_at, attempt_count, \
                    generation_failure_alert_id\
                 ) VALUES (\
                    'rt-repair', '{schedule_for_failure}', 1, 'invalid_category', 'template', \
                    'corr-r', '2026-02-01 09:00:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, \
                    'alert-block'\
                 )"
            ))
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("seed unrepaired failure");

    let blocked = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("blocked");
    assert_eq!(blocked.committed, 0);

    let writer = repo.writer().clone();
    writer
        .exec(|conn| {
            diesel::sql_query(
                "DELETE FROM recurring_generation_failures WHERE recurring_transaction_id = 'rt-repair'",
            )
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("repair");

    let outcome = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("after repair");
    assert_eq!(outcome.committed, 1);
    assert_canonical_fulfillment(&repo, 1);
}

#[tokio::test]
async fn cancellation_between_commits_keeps_completed_occurrence() {
    let observed = local(2026, 3, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-cancel".into(),
            description: "Cancel".into(),
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

    let cancelled = AtomicBool::new(false);
    let first = service
        .process_due(
            observed,
            ProcessingWorkBudget::occurrences(1),
            Some(&cancelled),
        )
        .await
        .expect("first");
    assert_eq!(first.committed, 1);
    cancelled.store(true, Ordering::SeqCst);
    let second = service
        .process_due(
            observed,
            ProcessingWorkBudget::occurrences(1),
            Some(&cancelled),
        )
        .await
        .expect("cancelled");
    assert_eq!(second.stop_reason, ProcessingStopReason::Cancelled);
    assert_eq!(second.committed, 0);
    assert_canonical_fulfillment(&repo, 1);
}
