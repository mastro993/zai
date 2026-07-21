use super::process_test_support::{local, seed_source, setup_service};
use super::seed::SeedRecurringSource;
use crate::schema::recurring_generation_failures;
use diesel::prelude::*;
use zai_core::features::recurring_transactions::{
    ProcessingStopReason, ProcessingWorkBudget, RECURRING_GENERATION_FAILURE_PRODUCER_KEY,
    RECURRING_OCCURRENCE_PRODUCER_KEY, RecurringOccurrenceProcessor,
    RecurringTransactionsServiceTrait,
};

#[tokio::test]
async fn stale_head_with_existing_occurrence_heals_as_already_fulfilled() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    let (schedule_id, template_id) = seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-stale".into(),
            name: "Stale head".into(),
            lifecycle: "active",
            total_occurrences: Some(2),
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

    let writer = repo.writer().clone();
    let schedule_for_seed = schedule_id.clone();
    let template_for_seed = template_id.clone();
    writer
        .exec(move |conn| {
            diesel::sql_query(
                "INSERT INTO transactions (id, amount, transaction_date, transaction_type, created_at, updated_at) \
                 VALUES ('txn-stale', 100, '2026-01-01 09:00:00', 'expense', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            )
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            diesel::sql_query(format!(
                "INSERT INTO domain_alerts (id, producer_key, occurrence_key, severity, title, body, created_at, updated_at) \
                 VALUES ('alert-stale', '{}', 'rt-stale|{schedule_for_seed}|1', 'info', 'Stale', 'Already generated', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                RECURRING_OCCURRENCE_PRODUCER_KEY,
            ))
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            diesel::sql_query(format!(
                "INSERT INTO recurring_occurrences (\
                    recurring_transaction_id, schedule_revision_id, ordinal, scheduled_local, \
                    template_revision_id, fulfilled_at, fulfillment_position, transaction_id, \
                    fulfillment_kind, recurring_alert_id\
                 ) VALUES (\
                    'rt-stale', '{schedule_for_seed}', 1, '2026-01-01 09:00:00', \
                    '{template_for_seed}', CURRENT_TIMESTAMP, 1, 'txn-stale', \
                    'generated', 'alert-stale'\
                 )"
            ))
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("seed fulfilled occurrence with lagging head");

    let outcome = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("heal");
    assert_eq!(outcome.committed, 0);
    assert_eq!(outcome.already_fulfilled, 1);

    let document = service.get_document("rt-stale").await.expect("document");
    assert_eq!(document.recurring_transaction.fulfilled_count, 1);
    assert_eq!(document.links.occurrences.items.len(), 1);
    let head = document.head.expect("head advanced");
    assert_eq!(head.next_ordinal, 2);
    assert_eq!(head.next_scheduled_local, local(2026, 2, 1, 9, 0));

    let continue_catch_up = service
        .process_due(observed, ProcessingWorkBudget::occurrences(5), None)
        .await
        .expect("continue");
    assert_eq!(continue_catch_up.committed, 1);
    assert!(!continue_catch_up.more_due_remaining);
}

#[tokio::test]
async fn more_due_remaining_ignores_heads_blocked_by_unrepaired_failure() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-healthy".into(),
            name: "Healthy".into(),
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
    let (blocked_schedule, _) = seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-block-remain".into(),
            name: "Blocked remain".into(),
            lifecycle: "active",
            total_occurrences: None,
            fulfilled_count: 0,
            revision: 1,
            first_scheduled_local: local(2026, 2, 2, 9, 0),
            next_scheduled_local: local(2026, 2, 2, 9, 0),
            next_ordinal: 1,
            amount: 100,
            transaction_type: "expense",
        },
    )
    .await;

    let writer = repo.writer().clone();
    writer
        .exec(move |conn| {
            diesel::sql_query(format!(
                "INSERT INTO domain_alerts (id, producer_key, occurrence_key, severity, title, body, created_at, updated_at) \
                 VALUES ('alert-remain', '{}', 'rt-block-remain|sched|1', 'critical', 'Blocked', 'Needs repair', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                RECURRING_GENERATION_FAILURE_PRODUCER_KEY,
            ))
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            diesel::insert_into(recurring_generation_failures::table)
                .values((
                    recurring_generation_failures::recurring_transaction_id.eq("rt-block-remain"),
                    recurring_generation_failures::schedule_revision_id.eq(blocked_schedule),
                    recurring_generation_failures::ordinal.eq(1),
                    recurring_generation_failures::error_code.eq("invalid_category"),
                    recurring_generation_failures::cause_category.eq("template"),
                    recurring_generation_failures::correlation_id.eq("corr-remain"),
                    recurring_generation_failures::failed_scheduled_local
                        .eq(local(2026, 2, 2, 9, 0)),
                    recurring_generation_failures::first_failed_at
                        .eq(chrono::Utc::now().naive_utc()),
                    recurring_generation_failures::last_failed_at
                        .eq(chrono::Utc::now().naive_utc()),
                    recurring_generation_failures::attempt_count.eq(1),
                    recurring_generation_failures::generation_failure_alert_id.eq("alert-remain"),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("seed blocked source");

    let outcome = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("process");
    assert_eq!(outcome.committed, 1);
    assert!(!outcome.more_due_remaining);
    assert_eq!(outcome.stop_reason, ProcessingStopReason::BudgetExhausted);
}
