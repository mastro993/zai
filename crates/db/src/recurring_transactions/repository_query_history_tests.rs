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
