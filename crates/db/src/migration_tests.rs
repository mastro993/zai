use crate::connection::{create_pool, run_migrations};
use crate::test_utils::TempDb;
use diesel::Connection;
use diesel::RunQueryDsl;
use diesel::prelude::QueryableByName;
use diesel::sqlite::SqliteConnection;
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};

const TEST_MIGRATIONS: EmbeddedMigrations = embed_migrations!();

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    count: i64,
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

    assert_eq!(migration_count.count, 7);
    assert_eq!(table_count.count, 5);
    assert_eq!(role_column_count.count, 1);
    assert_eq!(index_count.count, 8);
    assert!(
        budget_table
            .statement
            .contains("'day', 'week', 'month', 'year'")
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
        .expect("revert migration");
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
