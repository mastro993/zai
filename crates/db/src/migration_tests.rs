use crate::connection::{create_pool, run_migrations};
use crate::test_utils::TempDb;
use diesel::Connection;
use diesel::RunQueryDsl;
use diesel::prelude::QueryableByName;
use diesel::sqlite::SqliteConnection;
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};

const TEST_MIGRATIONS: EmbeddedMigrations = embed_migrations!();

#[derive(QueryableByName)]
pub(crate) struct CountRow {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    pub(crate) count: i64,
}

#[derive(QueryableByName)]
struct SqlRow {
    #[diesel(sql_type = diesel::sql_types::Text)]
    statement: String,
}

#[test]
fn fresh_database_applies_squashed_budget_migration_with_current_schema() {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");

    run_migrations(&pool).expect("migrations");

    let migration_count =
        diesel::sql_query("SELECT COUNT(*) AS count FROM __diesel_schema_migrations")
            .get_result::<CountRow>(&mut connection)
            .expect("migration history");
    let table_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('transaction_categories', 'transactions', 'budgets', 'budget_configurations', 'budget_period_results')",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("current tables");
    let role_column_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM pragma_table_info('transaction_categories') WHERE name = 'role'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("category role column");
    let index_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name IN ('transactions_type_index', 'transaction_categories_id_index', 'transaction_categories_root_name_unique', 'transaction_categories_child_name_unique', 'transactions_active_date_index', 'transactions_active_category_date_index', 'budgets_active_name_unique', 'budget_period_results_budget_period_index')",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("current indexes");
    let budget_table = diesel::sql_query(
        "SELECT sql AS statement FROM sqlite_master WHERE type = 'table' AND name = 'budgets'",
    )
    .get_result::<SqlRow>(&mut connection)
    .expect("budget table");

    assert_eq!(migration_count.count, 9);
    assert_eq!(table_count.count, 5);
    assert_eq!(role_column_count.count, 1);
    assert_eq!(index_count.count, 8);
    assert!(
        budget_table
            .statement
            .contains("'day', 'week', 'month', 'year'")
    );
    let paused_column_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM pragma_table_info('budgets') WHERE name = 'paused'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("budget paused column");
    assert_eq!(paused_column_count.count, 1);

    let domain_alert_table_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'domain_alerts'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("domain alerts table");
    let domain_alert_column_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM pragma_table_info('domain_alerts') WHERE name IN ('id', 'producer_key', 'occurrence_key', 'severity', 'title', 'body', 'destination', 'data', 'created_at', 'read_at')",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("domain alerts columns");
    let domain_alert_index_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name IN ('domain_alerts_producer_occurrence_unique', 'domain_alerts_canonical_traversal_index', 'domain_alerts_unread_lookup_index')",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("domain alerts indexes");
    let domain_alert_table = diesel::sql_query(
        "SELECT sql AS statement FROM sqlite_master WHERE type = 'table' AND name = 'domain_alerts'",
    )
    .get_result::<SqlRow>(&mut connection)
    .expect("domain alerts table sql");

    assert_eq!(domain_alert_table_count.count, 1);
    assert_eq!(domain_alert_column_count.count, 10);
    assert_eq!(domain_alert_index_count.count, 3);
    assert!(
        domain_alert_table
            .statement
            .contains("'info', 'warning', 'critical'")
    );
}

#[test]
fn baseline_migration_can_be_reverted() {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");

    run_migrations(&pool).expect("migrations");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert domain alerts migration");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert migration");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert budget lifecycle migration");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert budget migration");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert budget schema migration");

    let budget_table_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('budgets', 'budget_configurations', 'budget_period_results')",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("budget tables");
    let core_table_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('transaction_categories', 'transactions')",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("core tables");

    assert_eq!(budget_table_count.count, 0);
    assert_eq!(core_table_count.count, 2);
}

#[test]
fn pre_alert_finance_data_survives_domain_alerts_migration() {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");

    run_migrations(&pool).expect("migrations");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert domain alerts migration");

    diesel::sql_query(
        "INSERT INTO transaction_categories (id, name, role, created_at, updated_at) \
         VALUES ('cat-1', 'Food', 'spending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    )
    .execute(&mut connection)
    .expect("seed category");
    diesel::sql_query(
        "INSERT INTO transactions (id, amount, transaction_date, transaction_type, created_at, updated_at) \
         VALUES ('txn-1', 1500, CURRENT_TIMESTAMP, 'expense', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    )
    .execute(&mut connection)
    .expect("seed transaction");
    diesel::sql_query(
        "INSERT INTO budgets (id, name, cadence, measurement_mode, base_allowance, rollover_mode, created_at, updated_at, revision, paused) \
         VALUES ('budget-1', 'Monthly food', 'month', 'spending', 10000, 'off', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0)",
    )
    .execute(&mut connection)
    .expect("seed budget");

    let category_count_before = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM transaction_categories WHERE id = 'cat-1'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("category count before");
    let transaction_count_before =
        diesel::sql_query("SELECT COUNT(*) AS count FROM transactions WHERE id = 'txn-1'")
            .get_result::<CountRow>(&mut connection)
            .expect("transaction count before");
    let budget_count_before =
        diesel::sql_query("SELECT COUNT(*) AS count FROM budgets WHERE id = 'budget-1'")
            .get_result::<CountRow>(&mut connection)
            .expect("budget count before");

    run_migrations(&pool).expect("apply domain alerts migration");

    let category_count_after = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM transaction_categories WHERE id = 'cat-1'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("category count after");
    let transaction_count_after =
        diesel::sql_query("SELECT COUNT(*) AS count FROM transactions WHERE id = 'txn-1'")
            .get_result::<CountRow>(&mut connection)
            .expect("transaction count after");
    let budget_count_after =
        diesel::sql_query("SELECT COUNT(*) AS count FROM budgets WHERE id = 'budget-1'")
            .get_result::<CountRow>(&mut connection)
            .expect("budget count after");
    let domain_alert_table_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'domain_alerts'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("domain alerts table");

    assert_eq!(category_count_before.count, category_count_after.count);
    assert_eq!(
        transaction_count_before.count,
        transaction_count_after.count
    );
    assert_eq!(budget_count_before.count, budget_count_after.count);
    assert_eq!(domain_alert_table_count.count, 1);
}
