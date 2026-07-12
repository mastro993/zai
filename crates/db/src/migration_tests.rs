use crate::connection::{create_pool, run_migrations};
use crate::test_utils::TempDb;
use diesel::Connection;
use diesel::RunQueryDsl;
use diesel::connection::SimpleConnection;
use diesel::prelude::QueryableByName;
use diesel::sql_types::{BigInt, Text};
use diesel::sqlite::SqliteConnection;
use std::path::Path;

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

#[derive(QueryableByName)]
struct BudgetRow {
    #[diesel(sql_type = Text)]
    name: String,
    #[diesel(sql_type = Text)]
    cadence: String,
    #[diesel(sql_type = BigInt)]
    base_allowance: i64,
}

#[test]
fn migrations_convert_legacy_budget_table_before_creating_current_schema() {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    connection
        .batch_execute(
            "
            PRAGMA foreign_keys = ON;
            CREATE TABLE __diesel_schema_migrations (
                version VARCHAR(50) PRIMARY KEY NOT NULL,
                run_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO __diesel_schema_migrations (version) VALUES
                ('202509260654000000'),
                ('202607051915000001'),
                ('202607101700000002'),
                ('202607120900000003');
            CREATE TABLE transaction_categories (
                id TEXT NOT NULL PRIMARY KEY,
                parent_id TEXT,
                name TEXT NOT NULL,
                description TEXT,
                color TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP,
                role TEXT NOT NULL DEFAULT 'spending'
            );
            CREATE TABLE transactions (
                id TEXT NOT NULL PRIMARY KEY,
                description TEXT,
                amount INTEGER NOT NULL,
                transaction_date TIMESTAMP NOT NULL,
                transaction_type TEXT NOT NULL,
                transaction_category_id TEXT,
                notes TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            );
            CREATE INDEX transactions_active_date_index
                ON transactions (transaction_date DESC)
                WHERE deleted_at IS NULL;
            CREATE INDEX transactions_active_category_date_index
                ON transactions (transaction_category_id, transaction_date DESC)
                WHERE deleted_at IS NULL;
            CREATE TABLE budgets (
                id TEXT NOT NULL PRIMARY KEY,
                name TEXT NOT NULL,
                cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly', 'yearly')),
                first_period_start DATE NOT NULL,
                deactivated_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL
            );
            CREATE INDEX budgets_deactivated_at_idx ON budgets (deactivated_at);
            INSERT INTO budgets
                (id, name, cadence, first_period_start, created_at, updated_at)
            VALUES
                ('legacy-budget', 'Legacy budget', 'monthly', '2026-07-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            CREATE TABLE budget_revisions (
                id TEXT NOT NULL PRIMARY KEY,
                budget_id TEXT NOT NULL REFERENCES budgets (id),
                effective_period_start DATE NOT NULL,
                allowance INTEGER NOT NULL CHECK (allowance >= 0),
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                UNIQUE (budget_id, effective_period_start)
            );
            CREATE TABLE budget_revision_scopes (
                revision_id TEXT NOT NULL REFERENCES budget_revisions (id),
                category_id TEXT NOT NULL REFERENCES transaction_categories (id),
                PRIMARY KEY (revision_id, category_id)
            );
            INSERT INTO budget_revisions
                (id, budget_id, effective_period_start, allowance, created_at, updated_at)
            VALUES
                ('legacy-revision', 'legacy-budget', '2026-07-01', 12000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            ",
        )
        .expect("create legacy schema");
    drop(connection);

    let pool = create_pool(Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");

    let mut connection = pool.get().expect("connection");
    let current_budget_count = diesel::sql_query("SELECT COUNT(*) AS count FROM budgets")
        .get_result::<CountRow>(&mut connection)
        .expect("current budget table");
    let legacy_budget_table_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'budgets_legacy_0004'",
    )
        .get_result::<CountRow>(&mut connection)
        .expect("legacy budget table removal");
    let current_budget = diesel::sql_query(
        "SELECT name, cadence, base_allowance FROM budgets WHERE id = 'legacy-budget'",
    )
    .get_result::<BudgetRow>(&mut connection)
    .expect("converted budget");
    let configuration_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM budget_configurations WHERE budget_id = 'legacy-budget'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("converted budget configuration");
    let current_budget_columns = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM pragma_table_info('budgets') WHERE name = 'measurement_mode'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("current budget columns");

    assert_eq!(current_budget_count.count, 1);
    assert_eq!(legacy_budget_table_count.count, 0);
    assert_eq!(current_budget.name, "Legacy budget");
    assert_eq!(current_budget.cadence, "month");
    assert_eq!(current_budget.base_allowance, 12_000);
    assert_eq!(configuration_count.count, 1);
    assert_eq!(current_budget_columns.count, 1);
}
