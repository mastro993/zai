use super::fulfill::FAIL_AFTER_TRANSACTION_INSERT;
use super::process_test_support::{local, seed_source, setup_service};
use super::seed::SeedRecurringSource;
use crate::connection::get_connection;
use crate::schema::{domain_alerts, recurring_generation_failures, transactions};
use diesel::prelude::*;
use std::sync::atomic::Ordering;
use zai_core::features::recurring_transactions::{
    FulfillmentKind, ProcessingWorkBudget, RECURRING_GENERATION_FAILURE_PRODUCER_KEY,
    RECURRING_OCCURRENCE_PRODUCER_KEY, RecurringLifecycle, RecurringOccurrenceProcessor,
    RecurringTransactionsRepositoryTrait, RecurringTransactionsServiceTrait,
};

#[tokio::test]
async fn fulfillment_rolls_back_atomically_when_side_effect_fails() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-atomic".into(),
            description: "Atomic".into(),
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

    FAIL_AFTER_TRANSACTION_INSERT.store(true, Ordering::SeqCst);
    let error = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect_err("injected failure");
    FAIL_AFTER_TRANSACTION_INSERT.store(false, Ordering::SeqCst);
    assert!(error.to_string().contains("Injected fulfillment failure"));

    let document = service.get_document("rt-atomic").await.expect("document");
    assert!(document.links.occurrences.items.is_empty());
    assert_eq!(document.recurring_transaction.fulfilled_count, 0);
    assert!(document.head.is_some());

    let pool = repo.pool().clone();
    let txn_count: i64 = tokio::task::spawn_blocking(move || {
        let mut conn = get_connection(&pool).expect("conn");
        transactions::table
            .filter(transactions::deleted_at.is_null())
            .count()
            .get_result(&mut conn)
            .expect("count")
    })
    .await
    .expect("join");
    assert_eq!(txn_count, 0);

    let pool = repo.pool().clone();
    let alert_count: i64 = tokio::task::spawn_blocking(move || {
        let mut conn = get_connection(&pool).expect("conn");
        domain_alerts::table
            .filter(domain_alerts::producer_key.eq(RECURRING_OCCURRENCE_PRODUCER_KEY))
            .count()
            .get_result(&mut conn)
            .expect("count")
    })
    .await
    .expect("join");
    assert_eq!(alert_count, 0);
}

#[tokio::test]
async fn finite_source_completes_and_idempotent_replay_creates_nothing() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-finite".into(),
            description: "Finite".into(),
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

    let first = service
        .process_due(observed, ProcessingWorkBudget::occurrences(10), None)
        .await
        .expect("process");
    assert_eq!(first.committed, 2);
    assert!(!first.more_due_remaining);

    let document = service.get_document("rt-finite").await.expect("document");
    assert_eq!(
        document.recurring_transaction.lifecycle,
        RecurringLifecycle::Completed
    );
    assert_eq!(document.recurring_transaction.fulfilled_count, 2);
    assert!(document.head.is_none());
    assert_eq!(document.links.occurrences.items.len(), 2);
    let alert = {
        let pool = repo.pool().clone();
        let alert_id = document.links.occurrences.items[0]
            .recurring_alert_id
            .clone()
            .expect("alert");
        tokio::task::spawn_blocking(move || {
            let mut conn = get_connection(&pool).expect("conn");
            domain_alerts::table
                .filter(domain_alerts::id.eq(alert_id))
                .select((
                    domain_alerts::title,
                    domain_alerts::body,
                    domain_alerts::data,
                ))
                .first::<(String, String, Option<String>)>(&mut conn)
                .expect("alert")
        })
        .await
        .expect("join")
    };
    assert!(alert.0.contains("1 of 2") || alert.0.contains("2 of 2"));
    assert!(alert.1.contains("remaining"));
    assert!(
        alert
            .2
            .as_ref()
            .is_some_and(|data| data.contains("position"))
    );

    let replay = service
        .process_due(observed, ProcessingWorkBudget::occurrences(10), None)
        .await
        .expect("replay");
    assert_eq!(replay.committed, 0);
    assert_eq!(replay.already_fulfilled, 0);
    assert!(!replay.more_due_remaining);

    let after = service.get_document("rt-finite").await.expect("document");
    assert_eq!(after.links.occurrences.items.len(), 2);
    assert_eq!(
        after.recurring_transaction.revision,
        document.recurring_transaction.revision
    );
}

#[tokio::test]
async fn indefinite_alert_omits_counts_and_adopted_rules_forbid_alert() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-indef".into(),
            description: "Indefinite".into(),
            lifecycle: "active",
            total_occurrences: None,
            fulfilled_count: 0,
            revision: 1,
            first_scheduled_local: local(2026, 2, 1, 9, 0),
            next_scheduled_local: local(2026, 2, 1, 9, 0),
            next_ordinal: 1,
            amount: 100,
            transaction_type: "income",
        },
    )
    .await;

    service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("process");
    let document = service.get_document("rt-indef").await.expect("document");
    let occurrence = &document.links.occurrences.items[0];
    assert_eq!(occurrence.fulfillment_kind, FulfillmentKind::Generated);
    assert!(occurrence.recurring_alert_id.is_some());

    let pool = repo.pool().clone();
    let alert_id = occurrence.recurring_alert_id.clone().expect("alert");
    let (title, body, data) = tokio::task::spawn_blocking(move || {
        let mut conn = get_connection(&pool).expect("conn");
        domain_alerts::table
            .filter(domain_alerts::id.eq(alert_id))
            .select((
                domain_alerts::title,
                domain_alerts::body,
                domain_alerts::data,
            ))
            .first::<(String, String, Option<String>)>(&mut conn)
            .expect("alert")
    })
    .await
    .expect("join");
    assert!(!title.contains(" of "));
    assert!(!body.contains("remaining"));
    assert!(data.is_some_and(|value| {
        !value.contains("\"position\"")
            && !value.contains("\"total\"")
            && !value.contains("\"remaining\"")
    }));

    let pool = repo.pool().clone();
    let rejected = tokio::task::spawn_blocking(move || {
        let mut conn = get_connection(&pool).expect("conn");
        conn.immediate_transaction(|conn| {
            diesel::sql_query(
                "INSERT INTO transactions (id, amount, transaction_date, transaction_type, created_at, updated_at) \
                 VALUES ('txn-adopt', 1, '2026-01-01 00:00:00', 'expense', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            )
            .execute(conn)?;
            diesel::sql_query(
                "INSERT INTO recurring_occurrences (\
                    recurring_transaction_id, schedule_revision_id, ordinal, scheduled_local, \
                    template_revision_id, fulfilled_at, fulfillment_position, transaction_id, \
                    fulfillment_kind, recurring_alert_id\
                 ) VALUES (\
                    'rt-indef', 'rt-indef-sched-1', 99, '2026-01-01 00:00:00', \
                    'rt-indef-tmpl-1', CURRENT_TIMESTAMP, 99, 'txn-adopt', \
                    'adopted', 'not-null-alert'\
                 )",
            )
            .execute(conn)
        })
    })
    .await
    .expect("join");
    assert!(rejected.is_err());
}

#[tokio::test]
async fn repaired_failure_is_resolved_on_successful_fulfillment() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (schedule_id, _) = seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-repaired".into(),
            description: "Repaired".into(),
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

    let writer = repo.writer().clone();
    let schedule_for_failure = schedule_id.clone();
    writer
        .exec(move |conn| {
            diesel::sql_query(format!(
                "INSERT INTO domain_alerts (id, producer_key, occurrence_key, severity, title, body, created_at, updated_at)                  VALUES ('alert-repaired', '{}', 'rt-repaired|sched|1', 'critical', 'Blocked', 'Needs repair', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                RECURRING_GENERATION_FAILURE_PRODUCER_KEY,
            ))
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            diesel::insert_into(recurring_generation_failures::table)
                .values((
                    recurring_generation_failures::recurring_transaction_id.eq("rt-repaired"),
                    recurring_generation_failures::schedule_revision_id.eq(schedule_for_failure),
                    recurring_generation_failures::ordinal.eq(1),
                    recurring_generation_failures::error_code.eq("invalid_category"),
                    recurring_generation_failures::cause_category.eq("template"),
                    recurring_generation_failures::correlation_id.eq("corr-2"),
                    recurring_generation_failures::failed_scheduled_local
                        .eq(local(2026, 2, 1, 9, 0)),
                    recurring_generation_failures::first_failed_at
                        .eq(chrono::Utc::now().naive_utc()),
                    recurring_generation_failures::last_failed_at
                        .eq(chrono::Utc::now().naive_utc()),
                    recurring_generation_failures::attempt_count.eq(1),
                    recurring_generation_failures::repaired_at
                        .eq(Some(chrono::Utc::now().naive_utc())),
                    recurring_generation_failures::repair_revision.eq(Some(1)),
                    recurring_generation_failures::generation_failure_alert_id.eq("alert-repaired"),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("seed repaired failure");

    let outcome = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("process");
    assert_eq!(outcome.committed, 1);

    let failure = repo
        .find_unresolved_failure("rt-repaired")
        .await
        .expect("failure");
    assert!(failure.is_none());

    let pool = repo.pool().clone();
    let resolved_at = tokio::task::spawn_blocking(move || {
        let mut conn = get_connection(&pool).expect("conn");
        domain_alerts::table
            .filter(domain_alerts::id.eq("alert-repaired"))
            .select(domain_alerts::resolved_at)
            .first::<Option<chrono::NaiveDateTime>>(&mut conn)
            .expect("alert")
    })
    .await
    .expect("join");
    assert!(resolved_at.is_some());
}
