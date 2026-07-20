use super::{
    RECURRING_TABLES, column_exists, migrate, rome_provider, scalar_text, table_exists,
    user_version,
};
use crate::migration_fixture_support::{assert_db_integrity, has_temp_old_tables};
use crate::test_utils::TempDb;
use diesel::Connection;
use diesel::RunQueryDsl;
use diesel::prelude::QueryableByName;
use diesel::sqlite::SqliteConnection;

#[test]
fn fresh_database_installs_recurring_mvp_schema() {
    let temp_db = TempDb::new();
    migrate(&temp_db, rome_provider()).expect("migrations");
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("connect");

    assert_eq!(user_version(&mut conn), 1);
    for table in RECURRING_TABLES {
        assert!(table_exists(&mut conn, table), "missing table {table}");
    }
    assert!(column_exists(&mut conn, "transactions", "time_zone"));
    assert!(column_exists(&mut conn, "budgets", "time_zone"));
    assert!(column_exists(&mut conn, "domain_alerts", "updated_at"));
    assert!(column_exists(&mut conn, "domain_alerts", "resolved_at"));

    for table in ["budget_configurations", "budget_period_results"] {
        for column in ["period_start", "period_end"] {
            let declared = scalar_text(
                &mut conn,
                &format!(
                    "SELECT type AS value FROM pragma_table_info('{table}') WHERE name = '{column}'"
                ),
            );
            assert_eq!(declared, "DATE", "{table}.{column}");
        }
    }

    assert!(!has_temp_old_tables(&mut conn));
    assert_db_integrity(&mut conn);
}

#[test]
fn downgrade_refused_while_recurring_data_exists() {
    let temp_db = TempDb::new();
    migrate(&temp_db, rome_provider()).expect("migrations");
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("connect");

    crate::ensure_recurring_schema_downgrade_allowed(&mut conn)
        .expect("empty recurring schema allows downgrade");

    diesel::sql_query(
        "INSERT INTO recurring_transactions (id, name, lifecycle, created_at, updated_at) \
         VALUES ('rec-1', 'Rent', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    )
    .execute(&mut conn)
    .expect("insert recurring row");

    let err = crate::ensure_recurring_schema_downgrade_allowed(&mut conn)
        .expect_err("recurring data must refuse downgrade");
    assert!(err.to_string().contains("recurring_transactions"));

    diesel::sql_query("DELETE FROM recurring_transactions")
        .execute(&mut conn)
        .expect("clear recurring rows");
    crate::ensure_recurring_schema_downgrade_allowed(&mut conn)
        .expect("empty again allows downgrade");
}

#[derive(Debug, QueryableByName)]
#[allow(dead_code)]
struct ExplainQueryPlanRow {
    #[diesel(sql_type = diesel::sql_types::Integer)]
    id: i32,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    parent: i32,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    notused: i32,
    #[diesel(sql_type = diesel::sql_types::Text)]
    detail: String,
}

fn assert_query_uses_index(conn: &mut SqliteConnection, sql: &str, index_name: &str) {
    let plan: Vec<ExplainQueryPlanRow> = diesel::sql_query(format!("EXPLAIN QUERY PLAN {sql}"))
        .load(conn)
        .expect("explain query plan");
    assert!(
        plan.iter().any(|row| row.detail.contains(index_name)),
        "expected {index_name} in query plan: {plan:?}"
    );
}

#[test]
fn recurring_and_alert_indexes_back_bounded_queries() {
    let temp_db = TempDb::new();
    migrate(&temp_db, rome_provider()).expect("migrations");
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("connect");

    assert_query_uses_index(
        &mut conn,
        "SELECT recurring_transaction_id FROM recurring_occurrence_heads \
         WHERE due_at_utc <= '2026-01-01 00:00:00' \
         ORDER BY due_at_utc, recurring_transaction_id",
        "recurring_occurrence_heads_due_index",
    );
    assert_query_uses_index(
        &mut conn,
        "SELECT ordinal FROM recurring_generation_failures \
         WHERE recurring_transaction_id = 'rec-1' ORDER BY created_at DESC",
        "recurring_generation_failures_history_index",
    );
    assert_query_uses_index(
        &mut conn,
        "SELECT id FROM recurring_schedule_revisions \
         WHERE recurring_transaction_id = 'rec-1' ORDER BY effective_from_utc",
        "recurring_schedule_revisions_source_from_index",
    );
    assert_query_uses_index(
        &mut conn,
        "SELECT id FROM domain_alerts WHERE resolved_at IS NULL \
         ORDER BY created_at DESC, id DESC",
        "domain_alerts_needs_attention_index",
    );
    assert_query_uses_index(
        &mut conn,
        "SELECT ordinal FROM recurring_occurrences \
         WHERE recurring_transaction_id = 'rec-1' \
         ORDER BY resolved_at_utc DESC, schedule_revision_id, ordinal",
        "recurring_occurrences_source_feed_index",
    );
    assert_query_uses_index(
        &mut conn,
        "SELECT transaction_id FROM recurring_occurrences \
         WHERE recurring_transaction_id = 'rec-1' AND fulfillment_position IS NOT NULL \
         ORDER BY fulfillment_position",
        "recurring_occurrences_provenance_index",
    );
    assert_query_uses_index(
        &mut conn,
        "SELECT id FROM recurring_transactions WHERE tombstoned_at IS NULL \
         ORDER BY updated_at DESC, id",
        "recurring_transactions_feed_index",
    );
}
