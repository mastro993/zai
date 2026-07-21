use super::queries::{
    find_provenance_by_transaction, list_due_heads, list_feed, list_unresolved_failures,
};
use super::seed::{SeedRecurringSource, seed_active_interval_source};
use crate::connection::{create_pool, get_connection, run_migrations};
use crate::errors::IntoStorage;
use crate::schema::{recurring_generation_failures, recurring_occurrences};
use crate::sql_statement_counter::ConnectionStatementCounter;
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use chrono::{NaiveDate, NaiveDateTime};
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

#[tokio::test]
async fn feed_and_due_discovery_use_indexes_and_cursor_paging() {
    let (temp_db, mut conn) = setup();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let repo = super::RecurringTransactionsRepository::new(Arc::clone(&pool), writer.clone());

    for index in 0..3 {
        let seed = SeedRecurringSource {
            id: format!("rt-{index}"),
            name: format!("Rent {index}"),
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
        name: "Salary".into(),
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
        name: "Writer path".into(),
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
