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
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::features::recurring_transactions::RecurringTransactionsRepositoryTrait;

#[derive(QueryableByName, Debug)]
struct ExplainQueryPlanRow {
    #[allow(dead_code)]
    #[diesel(sql_type = diesel::sql_types::Integer)]
    id: i32,
    #[allow(dead_code)]
    #[diesel(sql_type = diesel::sql_types::Integer)]
    parent: i32,
    #[allow(dead_code)]
    #[diesel(sql_type = diesel::sql_types::Integer)]
    notused: i32,
    #[diesel(sql_type = diesel::sql_types::Text)]
    detail: String,
}

fn local(year: i32, month: u32, day: u32, hour: u32, minute: u32) -> NaiveDateTime {
    NaiveDate::from_ymd_opt(year, month, day)
        .expect("date")
        .and_hms_opt(hour, minute, 0)
        .expect("time")
}

fn setup() -> (TempDb, SqliteConnection) {
    let temp_db = TempDb::new();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    let connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    (temp_db, connection)
}

fn explain_plan(conn: &mut SqliteConnection, sql: &str) -> Vec<ExplainQueryPlanRow> {
    sql_query(format!("EXPLAIN QUERY PLAN {sql}"))
        .load(conn)
        .expect("explain")
}

fn assert_uses_index(plan: &[ExplainQueryPlanRow], index_name: &str) {
    assert!(
        plan.iter().any(|row| row.detail.contains(index_name)),
        "expected {index_name} in plan: {plan:?}"
    );
}

fn seed_retained_history(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    schedule_revision_id: &str,
    template_revision_id: &str,
    count: i32,
) {
    for ordinal in 1..=count {
        let scheduled_local = local(2026, 1, 1, 9, 0) + Duration::days(i64::from(ordinal - 1));
        let scheduled_local = scheduled_local.format("%Y-%m-%d %H:%M:%S").to_string();
        let transaction_id = format!("{recurring_transaction_id}-txn-{ordinal}");
        diesel::sql_query(format!(
            "INSERT INTO transactions (id, description, amount, transaction_date, transaction_type, created_at, updated_at) \
             VALUES ('{transaction_id}', 'Retained history', 100, '{scheduled_local}', 'expense', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ))
        .execute(conn)
        .expect("transaction history");
        diesel::sql_query(format!(
            "INSERT INTO recurring_occurrences \
             (recurring_transaction_id, schedule_revision_id, ordinal, scheduled_local, template_revision_id, fulfilled_at, fulfillment_position, transaction_id, fulfillment_kind) \
             VALUES ('{recurring_transaction_id}', '{schedule_revision_id}', {ordinal}, '{scheduled_local}', '{template_revision_id}', CURRENT_TIMESTAMP, {ordinal}, '{transaction_id}', 'adopted')"
        ))
        .execute(conn)
        .expect("occurrence history");

        let alert_id = format!("{recurring_transaction_id}-alert-{ordinal}");
        let failure_at = scheduled_local.clone();
        diesel::sql_query(format!(
            "INSERT INTO domain_alerts (id, producer_key, occurrence_key, severity, title, body, created_at, updated_at) \
             VALUES ('{alert_id}', 'recurring.generation_failure', '{recurring_transaction_id}|failure|{ordinal}', 'critical', 'Failure', 'Repaired', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ))
        .execute(conn)
        .expect("failure alert history");
        diesel::sql_query(format!(
            "INSERT INTO recurring_generation_failures \
             (recurring_transaction_id, schedule_revision_id, ordinal, error_code, cause_category, correlation_id, failed_scheduled_local, first_failed_at, last_failed_at, attempt_count, repaired_at, repair_revision, resolved_at, resolution_kind, generation_failure_alert_id) \
             VALUES ('{recurring_transaction_id}', '{schedule_revision_id}', {ordinal}, 'invalid_category', 'template', 'correlation-{ordinal}', '{scheduled_local}', '{failure_at}', '{failure_at}', 1, '{failure_at}', 2, '{failure_at}', 'repaired', '{alert_id}')"
        ))
        .execute(conn)
        .expect("failure history");
    }
}

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
async fn provenance_and_failure_queries_are_indexed() {
    let (temp_db, mut conn) = setup();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");

    let seed = SeedRecurringSource {
        id: "rt-prov".into(),
        description: "Salary".into(),
        lifecycle: "active",
        total_occurrences: Some(12),
        fulfilled_count: 1,
        revision: 2,
        first_scheduled_local: local(2026, 1, 1, 9, 0),
        next_scheduled_local: local(2026, 2, 1, 9, 0),
        next_ordinal: 2,
        amount: 2500,
        transaction_type: "income",
    };
    let (schedule_id, template_id) = writer
        .exec(move |conn| seed_active_interval_source(conn, &seed))
        .await
        .expect("seed");

    writer
        .exec({
            let schedule_id = schedule_id.clone();
            let template_id = template_id.clone();
            move |conn| {
                diesel::sql_query(
                    "INSERT INTO transactions (id, amount, transaction_date, transaction_type, created_at, updated_at) \
                     VALUES ('txn-1', 2500, '2026-01-01 09:00:00', 'income', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                )
                .execute(conn)
                .into_storage()?;
                diesel::sql_query(
                    "INSERT INTO domain_alerts (id, producer_key, occurrence_key, severity, title, body, created_at, updated_at) \
                     VALUES ('alert-fail', 'recurring.generation_failure', 'rt-prov|sched|1', 'critical', 'Blocked', 'Needs repair', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                )
                .execute(conn)
                .into_storage()?;
                diesel::insert_into(recurring_occurrences::table)
                    .values((
                        recurring_occurrences::recurring_transaction_id.eq("rt-prov"),
                        recurring_occurrences::schedule_revision_id.eq(&schedule_id),
                        recurring_occurrences::ordinal.eq(1),
                        recurring_occurrences::scheduled_local.eq(local(2026, 1, 1, 9, 0)),
                        recurring_occurrences::template_revision_id.eq(&template_id),
                        recurring_occurrences::fulfilled_at.eq(chrono::Utc::now().naive_utc()),
                        recurring_occurrences::fulfillment_position.eq(1),
                        recurring_occurrences::transaction_id.eq("txn-1"),
                        recurring_occurrences::fulfillment_kind.eq("adopted"),
                        recurring_occurrences::recurring_alert_id.eq(None::<String>),
                    ))
                    .execute(conn)
                    .into_storage()?;
                diesel::insert_into(recurring_generation_failures::table)
                    .values((
                        recurring_generation_failures::recurring_transaction_id.eq("rt-prov"),
                        recurring_generation_failures::schedule_revision_id.eq(&schedule_id),
                        recurring_generation_failures::ordinal.eq(2),
                        recurring_generation_failures::error_code.eq("invalid_category"),
                        recurring_generation_failures::cause_category.eq("template"),
                        recurring_generation_failures::repair_field_key
                            .eq(Some("transactionCategoryId")),
                        recurring_generation_failures::correlation_id.eq("corr-1"),
                        recurring_generation_failures::failed_scheduled_local
                            .eq(local(2026, 2, 1, 9, 0)),
                        recurring_generation_failures::first_failed_at
                            .eq(chrono::Utc::now().naive_utc()),
                        recurring_generation_failures::last_failed_at
                            .eq(chrono::Utc::now().naive_utc()),
                        recurring_generation_failures::attempt_count.eq(1),
                        recurring_generation_failures::generation_failure_alert_id.eq("alert-fail"),
                    ))
                    .execute(conn)
                    .into_storage()?;
                Ok(())
            }
        })
        .await
        .expect("seed occurrence and failure");

    let provenance = find_provenance_by_transaction(&mut conn, "txn-1")
        .expect("provenance")
        .expect("present");
    assert_eq!(provenance.transaction_id, "txn-1");
    assert_eq!(provenance.fulfillment_kind.as_str(), "adopted");

    let unresolved = list_unresolved_failures(&mut conn, 20).expect("unresolved");
    assert_eq!(unresolved.len(), 1);

    let schedule =
        super::revisions::find_schedule_revision_at(&mut conn, "rt-prov", local(2026, 1, 15, 9, 0))
            .expect("schedule lookup")
            .expect("present");
    assert_eq!(schedule.id, schedule_id);

    let provenance_plan = explain_plan(
        &mut conn,
        "SELECT recurring_transaction_id FROM recurring_occurrences WHERE transaction_id = 'txn-1'",
    );
    assert!(
        provenance_plan.iter().any(|row| {
            row.detail.contains("transaction_id")
                && (row.detail.contains("SEARCH") || row.detail.contains("USING INDEX"))
        }),
        "expected indexed transaction_id provenance lookup: {provenance_plan:?}"
    );

    let failure_plan = explain_plan(
        &mut conn,
        "SELECT ordinal FROM recurring_generation_failures \
         WHERE recurring_transaction_id = 'rt-prov' \
         ORDER BY first_failed_at DESC, schedule_revision_id DESC, ordinal DESC LIMIT 20",
    );
    assert_uses_index(&failure_plan, "recurring_generation_failures_history_index");

    let occurrence_plan = explain_plan(
        &mut conn,
        "SELECT ordinal FROM recurring_occurrences \
         WHERE recurring_transaction_id = 'rt-prov' \
         ORDER BY scheduled_local DESC, schedule_revision_id DESC, ordinal DESC LIMIT 50",
    );
    assert_uses_index(&occurrence_plan, "recurring_occurrences_history_index");
}

#[tokio::test]
async fn mutations_go_through_serialized_writer_only() {
    let temp_db = TempDb::new();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    writer.reset_exec_count();

    let seed = SeedRecurringSource {
        id: "rt-writer".into(),
        description: "Writer path".into(),
        lifecycle: "active",
        total_occurrences: None,
        fulfilled_count: 0,
        revision: 1,
        first_scheduled_local: local(2026, 3, 1, 8, 0),
        next_scheduled_local: local(2026, 3, 1, 8, 0),
        next_ordinal: 1,
        amount: 10,
        transaction_type: "expense",
    };
    writer
        .exec(move |conn| seed_active_interval_source(conn, &seed))
        .await
        .expect("seed via writer");
    assert_eq!(writer.exec_count(), 1);

    let mut read_conn = get_connection(&pool).expect("read conn");
    let counter = ConnectionStatementCounter::install(&mut read_conn);
    let _ = list_feed(&mut read_conn, 10, None).expect("read feed");
    assert!(counter.count() >= 1);
}

#[test]
fn release_query_limits_default_and_cap_contract() {
    assert_eq!(normalize_feed_limit(50).expect("default feed"), 50);
    assert_eq!(normalize_feed_limit(101).expect("feed cap"), 100);
    assert_eq!(normalize_failure_limit(20).expect("default failure"), 20);
    assert_eq!(normalize_failure_limit(101).expect("failure cap"), 100);
    assert!(normalize_feed_limit(0).is_err());
    assert!(normalize_failure_limit(0).is_err());
}

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
