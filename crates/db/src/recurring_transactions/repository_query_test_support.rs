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

#[derive(QueryableByName, Debug)]
pub(crate) struct ExplainQueryPlanRow {
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
    pub(crate) detail: String,
}

pub(crate) fn local(year: i32, month: u32, day: u32, hour: u32, minute: u32) -> NaiveDateTime {
    NaiveDate::from_ymd_opt(year, month, day)
        .expect("date")
        .and_hms_opt(hour, minute, 0)
        .expect("time")
}

pub(crate) fn setup() -> (TempDb, SqliteConnection) {
    let temp_db = TempDb::new();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    let connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    (temp_db, connection)
}

pub(crate) fn explain_plan(conn: &mut SqliteConnection, sql: &str) -> Vec<ExplainQueryPlanRow> {
    sql_query(format!("EXPLAIN QUERY PLAN {sql}"))
        .load(conn)
        .expect("explain")
}

pub(crate) fn assert_uses_index(plan: &[ExplainQueryPlanRow], index_name: &str) {
    assert!(
        plan.iter().any(|row| row.detail.contains(index_name)),
        "expected {index_name} in plan: {plan:?}"
    );
}

pub(crate) fn seed_retained_history(
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

pub(crate) fn seed_unresolved_failure(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    schedule_revision_id: &str,
    ordinal: i32,
) {
    let scheduled_local = (local(2026, 1, 1, 9, 0) + Duration::days(i64::from(ordinal - 1)))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    let alert_id = format!("{recurring_transaction_id}-open-alert");
    diesel::sql_query(format!(
        "INSERT INTO domain_alerts (id, producer_key, occurrence_key, severity, title, body, created_at, updated_at) \
         VALUES ('{alert_id}', 'recurring.generation_failure', '{recurring_transaction_id}|failure|{ordinal}', 'critical', 'Failure', 'Needs repair', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ))
    .execute(conn)
    .expect("open failure alert");
    diesel::sql_query(format!(
        "INSERT INTO recurring_generation_failures \
         (recurring_transaction_id, schedule_revision_id, ordinal, error_code, cause_category, correlation_id, failed_scheduled_local, first_failed_at, last_failed_at, attempt_count, repaired_at, repair_revision, resolved_at, resolution_kind, generation_failure_alert_id) \
         VALUES ('{recurring_transaction_id}', '{schedule_revision_id}', {ordinal}, 'invalid_category', 'template', 'open-correlation', '{scheduled_local}', '{scheduled_local}', '{scheduled_local}', 1, NULL, NULL, NULL, NULL, '{alert_id}')"
    ))
    .execute(conn)
    .expect("open failure");
}
