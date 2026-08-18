use crate::connection::{create_pool, run_migrations};
use crate::test_utils::TempDb;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{Integer, Text};

#[derive(Debug, QueryableByName)]
#[allow(dead_code)]
struct ExplainQueryPlanRow {
    #[diesel(sql_type = Integer)]
    id: i32,
    #[diesel(sql_type = Integer)]
    parent: i32,
    #[diesel(sql_type = Integer)]
    notused: i32,
    #[diesel(sql_type = Text)]
    detail: String,
}

fn setup_conn() -> (TempDb, SqliteConnection) {
    let temp_db = TempDb::new();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    let conn = SqliteConnection::establish(temp_db.path()).expect("conn");
    (temp_db, conn)
}

fn explain(conn: &mut SqliteConnection, sql: &str) -> Vec<ExplainQueryPlanRow> {
    sql_query(format!("EXPLAIN QUERY PLAN {sql}"))
        .load(conn)
        .expect("explain")
}

fn assert_uses(plan: &[ExplainQueryPlanRow], needle: &str) {
    assert!(
        plan.iter().any(|row| row.detail.contains(needle)),
        "expected {needle} in {plan:?}"
    );
}

#[test]
fn explain_covers_required_valuation_lookups() {
    let (_temp, mut conn) = setup_conn();

    let generation_date = explain(
        &mut conn,
        "SELECT COALESCE(SUM(converted_amount), 0) \
         FROM transaction_valuations \
         WHERE generation_id = 'val-actual-1' \
           AND transaction_date >= '2026-08-01T00:00:00' \
           AND transaction_date < '2026-09-01T00:00:00'",
    );
    assert_uses(&generation_date, "transaction_valuations_generation_date");

    let generation_converted = explain(
        &mut conn,
        "SELECT converted_amount FROM transaction_valuations \
         WHERE generation_id = 'val-actual-1' AND converted_amount IS NOT NULL",
    );
    assert_uses(
        &generation_converted,
        "transaction_valuations_generation_converted",
    );

    let generation_complete = explain(
        &mut conn,
        "SELECT COUNT(*) FROM transaction_valuations \
         WHERE generation_id = 'val-actual-1' AND complete = 0",
    );
    assert_uses(
        &generation_complete,
        "transaction_valuations_generation_completeness",
    );

    let pending = explain(
        &mut conn,
        "SELECT id FROM transaction_exchange_rate_revisions \
         WHERE variant = 'pending' ORDER BY created_at",
    );
    assert_uses(
        &pending,
        "transaction_exchange_rate_revisions_pending_retry",
    );

    let provider = explain(
        &mut conn,
        "SELECT original_decimal FROM provider_rate_observations \
         WHERE rate_set_id = 'set-a' AND currency = 'USD' AND value_date = '2026-08-17'",
    );
    assert!(
        provider.iter().any(|row| {
            row.detail.contains("provider_rate_observations_lookup")
                || row
                    .detail
                    .contains("sqlite_autoindex_provider_rate_observations")
        }),
        "expected provider/currency/value-date index in {provider:?}"
    );
}
