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

    assert_eq!(migration_count.count, 11);
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
        "SELECT COUNT(*) AS count FROM pragma_table_info('domain_alerts') WHERE name IN ('id', 'producer_key', 'occurrence_key', 'severity', 'title', 'body', 'destination', 'data', 'created_at', 'updated_at', 'read_at', 'resolved_at')",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("domain alerts columns");
    let domain_alert_index_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name IN ('domain_alerts_producer_occurrence_unique', 'domain_alerts_canonical_traversal_index', 'domain_alerts_unread_lookup_index', 'domain_alerts_unresolved_lookup_index')",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("domain alerts indexes");
    let domain_alert_table = diesel::sql_query(
        "SELECT sql AS statement FROM sqlite_master WHERE type = 'table' AND name = 'domain_alerts'",
    )
    .get_result::<SqlRow>(&mut connection)
    .expect("domain alerts table sql");

    assert_eq!(domain_alert_table_count.count, 1);
    assert_eq!(domain_alert_column_count.count, 12);
    assert_eq!(domain_alert_index_count.count, 4);
    assert!(
        domain_alert_table
            .statement
            .contains("'info', 'warning', 'critical'")
    );

    let recurring_table_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN (\
         'recurring_transactions', 'recurring_schedule_revisions', 'recurring_template_revisions', \
         'recurring_occurrence_heads', 'recurring_occurrences', 'recurring_generation_failures')",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("recurring tables");
    assert_eq!(recurring_table_count.count, 6);
}

#[test]
fn baseline_migration_can_be_reverted() {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");

    run_migrations(&pool).expect("migrations");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert recurring description migration");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert recurring migration");
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
        .expect("revert recurring description migration");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert recurring migration");
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

#[derive(QueryableByName)]
struct AlertPreserveRow {
    #[diesel(sql_type = diesel::sql_types::Text)]
    id: String,
    #[diesel(sql_type = diesel::sql_types::Text)]
    title: String,
    #[diesel(sql_type = diesel::sql_types::Nullable<diesel::sql_types::Timestamp>)]
    read_at: Option<chrono::NaiveDateTime>,
    #[diesel(sql_type = diesel::sql_types::Timestamp)]
    created_at: chrono::NaiveDateTime,
    #[diesel(sql_type = diesel::sql_types::Timestamp)]
    updated_at: chrono::NaiveDateTime,
}

#[test]
fn populated_alerts_and_finance_survive_recurring_migration() {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");

    run_migrations(&pool).expect("migrations");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert recurring description migration");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert recurring");

    diesel::sql_query(
        "INSERT INTO transaction_categories (id, name, role, created_at, updated_at) \
         VALUES ('cat-r', 'Food', 'spending', '2026-01-01 00:00:00', '2026-01-01 00:00:00')",
    )
    .execute(&mut connection)
    .expect("category");
    diesel::sql_query(
        "INSERT INTO transactions (id, description, amount, transaction_date, transaction_type, created_at, updated_at) \
         VALUES ('txn-r', 'Groceries', 1500, '2026-01-15 12:30:00', 'expense', '2026-01-15 12:30:00', '2026-01-15 12:30:00')",
    )
    .execute(&mut connection)
    .expect("transaction");
    diesel::sql_query(
        "INSERT INTO budgets (id, name, cadence, measurement_mode, base_allowance, rollover_mode, created_at, updated_at, revision, paused) \
         VALUES ('budget-r', 'Food budget', 'month', 'spending', 10000, 'off', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 1, 0)",
    )
    .execute(&mut connection)
    .expect("budget");
    diesel::sql_query(
        "INSERT INTO domain_alerts (id, producer_key, occurrence_key, severity, title, body, created_at, read_at) \
         VALUES ('alert-r', 'budget.status', 'occ-1', 'warning', 'Near limit', 'Watch spending', '2026-01-10 08:00:00', '2026-01-11 09:00:00')",
    )
    .execute(&mut connection)
    .expect("alert");

    run_migrations(&pool).expect("apply recurring migration");

    let alert = diesel::sql_query(
        "SELECT id, title, read_at, created_at, updated_at FROM domain_alerts WHERE id = 'alert-r'",
    )
    .get_result::<AlertPreserveRow>(&mut connection)
    .expect("alert after");
    assert_eq!(alert.id, "alert-r");
    assert_eq!(alert.title, "Near limit");
    assert_eq!(
        alert.read_at.map(|value| value.to_string()),
        Some("2026-01-11 09:00:00".to_string())
    );
    assert_eq!(alert.created_at.to_string(), "2026-01-10 08:00:00");
    assert_eq!(alert.updated_at.to_string(), "2026-01-10 08:00:00");

    let txn_date: SqlRow = diesel::sql_query(
        "SELECT CAST(transaction_date AS TEXT) AS statement FROM transactions WHERE id = 'txn-r'",
    )
    .get_result(&mut connection)
    .expect("txn date");
    assert_eq!(txn_date.statement, "2026-01-15 12:30:00");

    let recurring_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'recurring_transactions'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("recurring table");
    assert_eq!(recurring_count.count, 1);
}

#[test]
fn recurring_downgrade_refuses_when_data_present_and_succeeds_when_empty() {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");

    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert recurring description migration");

    diesel::sql_query(
        "INSERT INTO recurring_transactions (\
            id, name, lifecycle, fulfilled_count, revision, lifecycle_changed_at, created_at, updated_at\
         ) VALUES (\
            'rt-1', 'Rent', 'active', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP\
         )",
    )
    .execute(&mut connection)
    .expect("seed recurring");

    let refuse = connection.revert_last_migration(TEST_MIGRATIONS);
    assert!(refuse.is_err(), "downgrade must refuse with recurring rows");

    diesel::sql_query("DELETE FROM recurring_transactions")
        .execute(&mut connection)
        .expect("clear recurring");

    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("empty downgrade");

    let recurring_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'recurring_transactions'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("recurring gone");
    assert_eq!(recurring_count.count, 0);

    let updated_column = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM pragma_table_info('domain_alerts') WHERE name = 'updated_at'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("updated_at gone");
    assert_eq!(updated_column.count, 0);
}
