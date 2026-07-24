#![allow(dead_code, unused_imports)]

use super::process_test_support::{local, process_until_caught_up, seed_source, setup_service};
use super::seed::SeedRecurringSource;
use crate::schema::{recurring_generation_failures, transaction_categories};
use diesel::prelude::*;
use zai_core::features::recurring_transactions::{
    FulfillmentKind, ProcessingWorkBudget, RECURRING_GENERATION_FAILURE_PRODUCER_KEY,
    RecurringOccurrenceProcessor, RecurringTransactionsServiceTrait,
};

#[tokio::test]
async fn generated_transaction_retains_scheduled_local_after_late_catch_up() {
    let scheduled = local(2026, 1, 15, 9, 0);
    let observed = local(2026, 3, 1, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (schedule_id, _) = seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-late".into(),
            description: "Late rent".into(),
            lifecycle: "active",
            total_occurrences: None,
            fulfilled_count: 0,
            revision: 1,
            first_scheduled_local: scheduled,
            next_scheduled_local: scheduled,
            next_ordinal: 1,
            amount: 50_000,
            transaction_type: "expense",
        },
    )
    .await;

    let outcome = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("process");
    assert_eq!(outcome.committed, 1);
    assert_eq!(outcome.observed_local, observed);

    let document = service.get_document("rt-late").await.expect("document");
    let occurrence = &document.links.occurrences.items[0];
    assert_eq!(occurrence.scheduled_local, scheduled);
    assert_eq!(occurrence.schedule_revision_id, schedule_id);
    assert_eq!(occurrence.fulfillment_kind, FulfillmentKind::Generated);
    assert!(occurrence.recurring_alert_id.is_some());

    let pool = repo.pool().clone();
    let transaction_id = occurrence.transaction_id.clone();
    let transaction_date = tokio::task::spawn_blocking(move || {
        use crate::connection::get_connection;
        use crate::schema::transactions;
        let mut conn = get_connection(&pool).expect("conn");
        transactions::table
            .filter(transactions::id.eq(transaction_id))
            .select(transactions::transaction_date)
            .first::<chrono::NaiveDateTime>(&mut conn)
            .expect("txn")
    })
    .await
    .expect("join");
    assert_eq!(transaction_date, scheduled);
}

#[tokio::test]
async fn processes_due_work_in_scheduled_local_then_identity_order() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;

    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-b".into(),
            description: "Second".into(),
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
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-a".into(),
            description: "First".into(),
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
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-c".into(),
            description: "Earlier".into(),
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

    assert_eq!(
        service
            .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
            .await
            .expect("first")
            .committed,
        1
    );
    assert_eq!(
        service
            .get_document("rt-c")
            .await
            .expect("c")
            .links
            .occurrences
            .items
            .len(),
        1
    );

    assert_eq!(
        service
            .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
            .await
            .expect("second")
            .committed,
        1
    );
    assert_eq!(
        service
            .get_document("rt-a")
            .await
            .expect("a")
            .links
            .occurrences
            .items
            .len(),
        1
    );

    assert_eq!(
        service
            .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
            .await
            .expect("third")
            .committed,
        1
    );
    assert_eq!(
        service
            .get_document("rt-b")
            .await
            .expect("b")
            .links
            .occurrences
            .items
            .len(),
        1
    );
}

#[tokio::test]
async fn open_failure_blocks_only_that_source() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (blocked_schedule, _) = seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-blocked".into(),
            description: "Blocked".into(),
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
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-ok".into(),
            description: "Healthy".into(),
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
    let schedule_id = blocked_schedule.clone();
    writer
        .exec(move |conn| {
            diesel::sql_query(format!(
                "INSERT INTO domain_alerts (id, producer_key, occurrence_key, severity, title, body, created_at, updated_at)                  VALUES ('alert-block', '{}', 'rt-blocked|sched|1', 'critical', 'Blocked', 'Needs repair', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                RECURRING_GENERATION_FAILURE_PRODUCER_KEY,
            ))
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            diesel::insert_into(recurring_generation_failures::table)
                .values((
                    recurring_generation_failures::recurring_transaction_id.eq("rt-blocked"),
                    recurring_generation_failures::schedule_revision_id.eq(schedule_id),
                    recurring_generation_failures::ordinal.eq(1),
                    recurring_generation_failures::error_code.eq("invalid_category"),
                    recurring_generation_failures::cause_category.eq("template"),
                    recurring_generation_failures::correlation_id.eq("corr-1"),
                    recurring_generation_failures::failed_scheduled_local
                        .eq(local(2026, 2, 1, 9, 0)),
                    recurring_generation_failures::first_failed_at
                        .eq(chrono::Utc::now().naive_utc()),
                    recurring_generation_failures::last_failed_at
                        .eq(chrono::Utc::now().naive_utc()),
                    recurring_generation_failures::attempt_count.eq(1),
                    recurring_generation_failures::generation_failure_alert_id.eq("alert-block"),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("seed failure");

    let outcome = process_until_caught_up(&service, observed, 2)
        .await
        .expect("process");
    assert_eq!(outcome.committed, 1);
    assert_eq!(
        service
            .get_document("rt-ok")
            .await
            .expect("ok")
            .links
            .occurrences
            .items
            .len(),
        1
    );
    assert!(
        service
            .get_document("rt-blocked")
            .await
            .expect("blocked")
            .links
            .occurrences
            .items
            .is_empty()
    );
}

#[tokio::test]
async fn invalid_deleted_category_records_failure_and_other_sources_continue() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (_, invalid_template) = seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-invalid-category".into(),
            description: "Invalid category".into(),
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
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-healthy-after-invalid".into(),
            description: "Healthy".into(),
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
            let category_now = chrono::Utc::now().naive_utc();
            diesel::insert_into(transaction_categories::table)
                .values((
                    transaction_categories::id.eq("deleted-category"),
                    transaction_categories::parent_id.eq(None::<String>),
                    transaction_categories::name.eq("Deleted"),
                    transaction_categories::description.eq(None::<String>),
                    transaction_categories::color.eq(None::<String>),
                    transaction_categories::role.eq("spending"),
                    transaction_categories::created_at.eq(category_now),
                    transaction_categories::updated_at.eq(category_now),
                    transaction_categories::deleted_at.eq(Some(category_now)),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            diesel::update(
                crate::schema::recurring_template_revisions::table
                    .filter(crate::schema::recurring_template_revisions::id.eq(invalid_template)),
            )
            .set(
                crate::schema::recurring_template_revisions::transaction_category_id
                    .eq(Some("deleted-category".to_string())),
            )
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("invalid category seed");

    let outcome = process_until_caught_up(&service, observed, 2)
        .await
        .expect("deterministic failure should be committed");
    assert_eq!(outcome.committed, 1);

    let invalid = service
        .get_document("rt-invalid-category")
        .await
        .expect("invalid source");
    let failure = invalid.failures.unresolved.expect("failure");
    assert_eq!(failure.error_code, "invalid_category");
    assert_eq!(
        failure.repair_field_key,
        Some(
            zai_core::features::recurring_transactions::RecurringRepairField::TransactionCategoryId
        )
    );
    assert!(invalid.links.occurrences.items.is_empty());

    let healthy = service
        .get_document("rt-healthy-after-invalid")
        .await
        .expect("healthy source");
    assert_eq!(healthy.links.occurrences.items.len(), 1);

    let pool = repo.pool().clone();
    let failure_alerts = tokio::task::spawn_blocking(move || {
        let mut conn = crate::connection::get_connection(&pool).expect("connection");
        crate::schema::domain_alerts::table
            .filter(
                crate::schema::domain_alerts::producer_key
                    .eq(RECURRING_GENERATION_FAILURE_PRODUCER_KEY),
            )
            .count()
            .get_result::<i64>(&mut conn)
            .expect("failure alerts")
    })
    .await
    .expect("join");
    assert_eq!(failure_alerts, 1);
}
