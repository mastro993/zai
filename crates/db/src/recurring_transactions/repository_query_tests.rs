#![allow(dead_code, unused_imports)]

use super::queries::{
    find_provenance_by_transaction, list_due_heads, list_failure_history, list_feed,
    list_occurrences, list_unresolved_failures, normalize_failure_limit, normalize_feed_limit,
};
use super::seed::{SeedRecurringSource, seed_active_interval_source};
use crate::connection::{create_pool, get_connection, run_migrations};
use crate::errors::IntoStorage;
use crate::schema::{recurring_generation_failures, recurring_occurrences};
use crate::sql_statement_counter::ConnectionStatementCounter;
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use chrono::{Duration, NaiveDate, NaiveDateTime};
use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::Error;
use zai_core::features::budgets::traits::LocalCalendarClock;
use zai_core::features::recurring_transactions::{
    RecurringTransactionsRepositoryTrait, RecurringTransactionsService,
    RecurringTransactionsServiceTrait,
};

use super::repository_query_test_support::{
    assert_uses_index, explain_plan, local, seed_retained_history, seed_unresolved_failure, setup,
};

#[tokio::test]
async fn feed_and_due_discovery_use_indexes_and_cursor_paging() {
    let (temp_db, mut conn) = setup();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let repo = super::RecurringTransactionsRepository::new(Arc::clone(&pool), writer.clone());

    for index in 0..3 {
        let seed = SeedRecurringSource {
            id: format!("rt-{index}"),
            description: format!("Rent {index}"),
            lifecycle: "active",
            total_occurrences: None,
            fulfilled_count: 0,
            revision: 1,
            first_scheduled_local: local(2026, 1, 1, 9, 0),
            next_scheduled_local: local(2026, 2, index as u32 + 1, 9, 0),
            next_ordinal: 1,
            amount: 1000,
            transaction_type: "expense",
        };
        writer
            .exec(move |conn| seed_active_interval_source(conn, &seed))
            .await
            .expect("seed");
    }

    let page = repo.list_feed(2, None).await.expect("feed");
    assert_eq!(page.items.len(), 2);
    assert!(page.next_cursor.is_some());
    assert!(
        page.items
            .iter()
            .all(|item| item.next_scheduled_local.is_some() && !item.needs_attention)
    );
    let page2 = repo
        .list_feed(2, page.next_cursor.clone())
        .await
        .expect("feed page 2");
    assert_eq!(page2.items.len(), 1);
    assert!(page2.next_cursor.is_none());
    let page_again = repo.list_feed(2, None).await.expect("repeat feed page");
    assert_eq!(
        page.items
            .iter()
            .map(|item| &item.recurring_transaction.id)
            .collect::<Vec<_>>(),
        page_again
            .items
            .iter()
            .map(|item| &item.recurring_transaction.id)
            .collect::<Vec<_>>()
    );
    assert!(page2.items.iter().all(|item| {
        !page
            .items
            .iter()
            .any(|first| first.recurring_transaction.id == item.recurring_transaction.id)
    }));

    let due = list_due_heads(&mut conn, local(2026, 2, 2, 9, 0), 50).expect("due");
    assert_eq!(due.len(), 2);

    let feed_plan = explain_plan(
        &mut conn,
        "SELECT id FROM recurring_transactions \
         WHERE deleted_at IS NULL \
         ORDER BY updated_at DESC, id DESC LIMIT 50",
    );
    assert_uses_index(&feed_plan, "recurring_transactions_visible_feed_index");

    let due_plan = explain_plan(
        &mut conn,
        "SELECT recurring_transaction_id FROM recurring_occurrence_heads \
         WHERE next_scheduled_local <= '2026-02-02 09:00:00' \
         ORDER BY next_scheduled_local, recurring_transaction_id LIMIT 50",
    );
    assert_uses_index(&due_plan, "recurring_occurrence_heads_due_discovery_index");
}

#[tokio::test]
async fn feed_includes_summaries_in_one_statement_independent_of_history() {
    let (temp_db, mut conn) = setup();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let seed = SeedRecurringSource {
        id: "rt-feed-summary".into(),
        description: "Summary source".into(),
        lifecycle: "active",
        total_occurrences: None,
        fulfilled_count: 120,
        revision: 1,
        first_scheduled_local: local(2026, 1, 1, 9, 0),
        next_scheduled_local: local(2030, 1, 1, 9, 0),
        next_ordinal: 121,
        amount: 100,
        transaction_type: "expense",
    };
    let (schedule_id, template_id) = writer
        .exec(move |conn| seed_active_interval_source(conn, &seed))
        .await
        .expect("seed source");
    seed_retained_history(
        &mut conn,
        "rt-feed-summary",
        &schedule_id,
        &template_id,
        120,
    );
    seed_unresolved_failure(&mut conn, "rt-feed-summary", &schedule_id, 121);

    let counter = ConnectionStatementCounter::install(&mut conn);
    let page = list_feed(&mut conn, 101, None).expect("feed");

    assert_eq!(counter.count(), 1);
    assert_eq!(page.items.len(), 1);
    assert_eq!(
        page.items[0].next_scheduled_local,
        Some(local(2030, 1, 1, 9, 0))
    );
    assert!(page.items[0].needs_attention);
}

#[tokio::test]
async fn feed_page_defaults_to_fifty_and_caps_at_one_hundred_sources() {
    let (temp_db, _conn) = setup();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let repo = Arc::new(super::RecurringTransactionsRepository::new(
        Arc::clone(&pool),
        writer.clone(),
    ));
    for index in 0..101 {
        let seed = SeedRecurringSource {
            id: format!("rt-feed-{index:03}"),
            description: format!("Feed source {index}"),
            lifecycle: "active",
            total_occurrences: None,
            fulfilled_count: 0,
            revision: 1,
            first_scheduled_local: local(2026, 1, 1, 9, 0),
            next_scheduled_local: local(2030, 1, 1, 9, 0),
            next_ordinal: 1,
            amount: 100,
            transaction_type: "expense",
        };
        writer
            .exec(move |conn| seed_active_interval_source(conn, &seed))
            .await
            .expect("seed source");
    }
    let service = RecurringTransactionsService::new(
        Arc::clone(&repo) as Arc<_>,
        Arc::new(LocalCalendarClock),
    );

    let default_page = service.list_feed(None, None).await.expect("default feed");
    let capped_page = service
        .list_feed(Some(101), None)
        .await
        .expect("capped feed");

    assert_eq!(default_page.items.len(), 50);
    assert!(default_page.next_cursor.is_some());
    assert_eq!(capped_page.items.len(), 100);
    assert!(capped_page.next_cursor.is_some());
    assert!(
        capped_page
            .items
            .windows(2)
            .all(|items| items[0].recurring_transaction.id > items[1].recurring_transaction.id)
    );
}

#[tokio::test]
async fn feed_storage_failure_remains_storage_error() {
    let (temp_db, mut conn) = setup();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let seed = SeedRecurringSource {
        id: "rt-feed-failure".into(),
        description: "Failure source".into(),
        lifecycle: "active",
        total_occurrences: None,
        fulfilled_count: 0,
        revision: 1,
        first_scheduled_local: local(2026, 1, 1, 9, 0),
        next_scheduled_local: local(2030, 1, 1, 9, 0),
        next_ordinal: 1,
        amount: 100,
        transaction_type: "expense",
    };
    writer
        .exec(move |conn| seed_active_interval_source(conn, &seed))
        .await
        .expect("seed source");
    conn.batch_execute("PRAGMA foreign_keys = OFF; DROP TABLE recurring_occurrence_heads;")
        .expect("inject feed storage failure");

    let error = list_feed(&mut conn, 50, None).expect_err("feed should fail");
    assert!(matches!(error, Error::Database(_)));
    assert!(!matches!(error, Error::NotFound(_) | Error::InvalidData(_)));
}

#[tokio::test]
async fn missing_schedule_revision_is_repository_error() {
    let (temp_db, mut conn) = setup();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let repo = Arc::new(super::RecurringTransactionsRepository::new(
        Arc::clone(&pool),
        writer.clone(),
    ));
    let seed = SeedRecurringSource {
        id: "rt-missing-schedule".into(),
        description: "Missing schedule source".into(),
        lifecycle: "active",
        total_occurrences: None,
        fulfilled_count: 0,
        revision: 1,
        first_scheduled_local: local(2026, 1, 1, 9, 0),
        next_scheduled_local: local(2030, 1, 1, 9, 0),
        next_ordinal: 1,
        amount: 100,
        transaction_type: "expense",
    };
    writer
        .exec(move |conn| seed_active_interval_source(conn, &seed))
        .await
        .expect("seed source");
    conn.batch_execute(
        "PRAGMA foreign_keys = OFF; \
         DELETE FROM recurring_schedule_revisions WHERE recurring_transaction_id = 'rt-missing-schedule'; \
         PRAGMA foreign_keys = ON;",
    )
    .expect("inject missing schedule");
    let service = RecurringTransactionsService::new(
        Arc::clone(&repo) as Arc<_>,
        Arc::new(LocalCalendarClock),
    );

    let error = service
        .get_document("rt-missing-schedule")
        .await
        .expect_err("document should fail");
    assert!(
        matches!(error, Error::Repository(message) if message.contains("Missing schedule revision"))
    );
}
