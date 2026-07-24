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
async fn occurrence_and_failure_cursor_paging_is_stable() {
    let (temp_db, mut conn) = setup();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let seed = SeedRecurringSource {
        id: "rt-cursors".into(),
        description: "Cursor source".into(),
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
    let (schedule_id, template_id) = writer
        .exec(move |conn| seed_active_interval_source(conn, &seed))
        .await
        .expect("seed source");
    seed_retained_history(&mut conn, "rt-cursors", &schedule_id, &template_id, 120);

    let occurrence_cap =
        list_occurrences(&mut conn, "rt-cursors", 101, None).expect("occurrence cap");
    assert_eq!(occurrence_cap.items.len(), 100);
    let failure_cap =
        list_failure_history(&mut conn, "rt-cursors", 101, None).expect("failure cap");
    assert_eq!(failure_cap.items.len(), 100);

    let occurrence_page = list_occurrences(&mut conn, "rt-cursors", 50, None).expect("occurrences");
    let occurrence_page_2 = list_occurrences(
        &mut conn,
        "rt-cursors",
        50,
        occurrence_page.next_cursor.as_deref(),
    )
    .expect("occurrence page 2");
    let occurrence_page_3 = list_occurrences(
        &mut conn,
        "rt-cursors",
        50,
        occurrence_page_2.next_cursor.as_deref(),
    )
    .expect("occurrence page 3");
    assert_eq!(occurrence_page.items.len(), 50);
    assert_eq!(occurrence_page_2.items.len(), 50);
    assert_eq!(occurrence_page_3.items.len(), 20);
    assert!(occurrence_page_3.next_cursor.is_none());
    assert!(occurrence_page.items.iter().all(|first| {
        occurrence_page_2
            .items
            .iter()
            .all(|second| first.ordinal != second.ordinal)
    }));
    let repeated_occurrence_page =
        list_occurrences(&mut conn, "rt-cursors", 50, None).expect("repeat occurrence page");
    assert_eq!(occurrence_page, repeated_occurrence_page);

    let failure_page = list_failure_history(&mut conn, "rt-cursors", 20, None).expect("failures");
    let failure_page_2 = list_failure_history(
        &mut conn,
        "rt-cursors",
        20,
        failure_page.next_cursor.as_deref(),
    )
    .expect("failure page 2");
    let failure_page_3 = list_failure_history(
        &mut conn,
        "rt-cursors",
        20,
        failure_page_2.next_cursor.as_deref(),
    )
    .expect("failure page 3");
    assert_eq!(failure_page.items.len(), 20);
    assert_eq!(failure_page_2.items.len(), 20);
    assert_eq!(failure_page_3.items.len(), 20);
    assert!(failure_page.items.iter().all(|first| {
        failure_page_2
            .items
            .iter()
            .all(|second| first.ordinal != second.ordinal)
    }));
    let repeated_failure_page =
        list_failure_history(&mut conn, "rt-cursors", 20, None).expect("repeat failure page");
    assert_eq!(failure_page, repeated_failure_page);
}

#[tokio::test]
async fn failure_history_excludes_open_failure() {
    let (temp_db, mut conn) = setup();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let seed = SeedRecurringSource {
        id: "rt-history-open".into(),
        description: "History source".into(),
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
    let (schedule_id, template_id) = writer
        .exec(move |conn| seed_active_interval_source(conn, &seed))
        .await
        .expect("seed source");
    seed_retained_history(&mut conn, "rt-history-open", &schedule_id, &template_id, 1);
    seed_unresolved_failure(&mut conn, "rt-history-open", &schedule_id, 2);

    let page = list_failure_history(&mut conn, "rt-history-open", 20, None).expect("history");

    assert_eq!(page.items.len(), 1);
    assert!(page.items[0].resolved_at.is_some());
    assert_eq!(page.items[0].ordinal, 1);
}

#[tokio::test]
async fn bounded_pages_keep_statement_count_independent_of_retained_history() {
    struct PageMeasurement {
        occurrence_count: usize,
        occurrence_statements: usize,
        failure_count: usize,
        failure_statements: usize,
    }

    async fn measure(history_size: i32) -> PageMeasurement {
        let (temp_db, mut conn) = setup();
        let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
        let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
        let seed = SeedRecurringSource {
            id: "rt-history".into(),
            description: "History source".into(),
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
        let (schedule_id, template_id) = writer
            .exec(move |conn| seed_active_interval_source(conn, &seed))
            .await
            .expect("seed source");
        seed_retained_history(
            &mut conn,
            "rt-history",
            &schedule_id,
            &template_id,
            history_size,
        );

        let occurrence_counter = ConnectionStatementCounter::install(&mut conn);
        let occurrences = list_occurrences(&mut conn, "rt-history", 50, None).expect("occurrences");
        let occurrence_statements = occurrence_counter.count();
        let failure_counter = ConnectionStatementCounter::install(&mut conn);
        let failures = list_failure_history(&mut conn, "rt-history", 20, None).expect("failures");
        let failure_statements = failure_counter.count();
        PageMeasurement {
            occurrence_count: occurrences.items.len(),
            occurrence_statements,
            failure_count: failures.items.len(),
            failure_statements,
        }
    }

    let empty = measure(0).await;
    let retained = measure(120).await;
    assert_eq!(empty.occurrence_count, 0);
    assert_eq!(empty.occurrence_statements, 1);
    assert_eq!(empty.failure_count, 0);
    assert_eq!(empty.failure_statements, 1);
    assert_eq!(retained.occurrence_count, 50);
    assert_eq!(retained.occurrence_statements, 1);
    assert_eq!(retained.failure_count, 20);
    assert_eq!(retained.failure_statements, 1);
}

#[tokio::test]
async fn create_persists_source_revisions_and_head_through_writer() {
    use zai_core::features::recurring_transactions::{
        NewRecurringTransaction, RecurringTemplateInput, ScheduleIntervalUnit, ScheduleRule,
    };

    let temp_db = TempDb::new();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    writer.reset_exec_count();
    let repo = super::RecurringTransactionsRepository::new(Arc::clone(&pool), writer.clone());

    let created = repo
        .create_recurring_transaction(NewRecurringTransaction {
            id: Some("rt-create".into()),
            schedule: ScheduleRule::Interval {
                every: 1,
                unit: ScheduleIntervalUnit::Month,
            },
            first_scheduled_local: local(2026, 8, 1, 9, 0),
            total_occurrences: Some(12),
            template: RecurringTemplateInput {
                description: "Membership".into(),
                amount: 4500,
                transaction_type: "expense".into(),
                transaction_category_id: None,
                notes: None,
            },
        })
        .await
        .expect("create");

    assert_eq!(writer.exec_count(), 1);
    assert_eq!(created.total_occurrences, Some(12));
    assert_eq!(created.fulfilled_count, 0);

    let feed = repo.list_feed(10, None).await.expect("feed");
    assert_eq!(feed.items.len(), 1);
    assert_eq!(feed.items[0].recurring_transaction.id, "rt-create");
    assert_eq!(feed.items[0].description, "Membership");

    let head = repo
        .get_occurrence_head("rt-create")
        .await
        .expect("head")
        .expect("present");
    assert_eq!(head.next_ordinal, 1);
    assert_eq!(head.next_scheduled_local, local(2026, 8, 1, 9, 0));

    let schedule = repo
        .find_open_schedule_revision("rt-create")
        .await
        .expect("schedule")
        .expect("present");
    assert!(matches!(
        schedule.rule,
        ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Month
        }
    ));
}
