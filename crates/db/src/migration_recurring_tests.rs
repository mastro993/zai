use crate::connection::{create_pool, run_migrations};
use crate::migration_fixture_support::{CountRow, TEST_MIGRATIONS};
use crate::test_utils::TempDb;
use diesel::Connection;
use diesel::RunQueryDsl;
use diesel::connection::SimpleConnection;
use diesel::prelude::QueryableByName;
use diesel::sqlite::SqliteConnection;
use diesel_migrations::MigrationHarness;

#[derive(QueryableByName)]
struct TextRow {
    #[diesel(sql_type = diesel::sql_types::Text)]
    value: String,
}

#[test]
fn recurring_schema_uses_final_description_contract() {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");

    let name_column_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM pragma_table_info('recurring_transactions') WHERE name = 'name'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("name column");
    assert_eq!(name_column_count.count, 0);

    let required_description_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM pragma_table_info('recurring_template_revisions') WHERE name = 'description' AND \"notnull\" = 1",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("description constraint");
    assert_eq!(required_description_count.count, 1);

    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name IN (
                'recurring_transactions_visible_feed_index',
                'recurring_schedule_revisions_open_unique',
                'recurring_schedule_revisions_effective_lookup_index',
                'recurring_template_revisions_open_unique',
                'recurring_template_revisions_effective_lookup_index',
                'recurring_occurrence_heads_due_discovery_index',
                'recurring_occurrences_history_index',
                'recurring_generation_failures_open_unique',
                'recurring_generation_failures_history_index',
                'recurring_generation_failures_unresolved_index'
            )",
        ),
        10
    );
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM pragma_foreign_key_check",
        ),
        0
    );
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM pragma_quick_check WHERE quick_check <> 'ok'",
        ),
        0
    );

    diesel::sql_query(
        "INSERT INTO recurring_transactions (
            id, lifecycle, fulfilled_count, revision, lifecycle_changed_at, created_at, updated_at
         ) VALUES
            ('rt-description-a', 'active', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('rt-description-b', 'active', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    )
    .execute(&mut connection)
    .expect("recurring transactions");
    diesel::sql_query(
        "INSERT INTO recurring_template_revisions (
            id, recurring_transaction_id, sequence, effective_from_local, description, amount, transaction_type
         ) VALUES
            ('tmpl-description-a', 'rt-description-a', 1, CURRENT_TIMESTAMP, 'Shared description', 100, 'expense'),
            ('tmpl-description-b', 'rt-description-b', 1, CURRENT_TIMESTAMP, 'Shared description', 100, 'expense')",
    )
    .execute(&mut connection)
    .expect("duplicate descriptions are allowed");

    let description_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM recurring_template_revisions WHERE description = 'Shared description'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("description rows");
    assert_eq!(description_count.count, 2);

    let blank_description = diesel::sql_query(
        "INSERT INTO recurring_template_revisions (
            id, recurring_transaction_id, sequence, effective_from_local, description, amount, transaction_type
         ) VALUES (
            'tmpl-description-blank', 'rt-description-a', 2, CURRENT_TIMESTAMP, '   ', 100, 'expense'
         )",
    )
    .execute(&mut connection);
    assert!(
        blank_description.is_err(),
        "blank descriptions must be rejected"
    );
}

#[test]
fn recurring_migration_failure_during_alert_rebuild_restores_previous_schema() {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert recurring migration");

    connection
        .batch_execute(
            "PRAGMA ignore_check_constraints = ON;
             INSERT INTO domain_alerts (
                 id, producer_key, occurrence_key, severity, title, body, created_at, read_at
             ) VALUES (
                 'alert-invalid', 'budget.status', 'invalid', 'warning', '', 'body',
                 CURRENT_TIMESTAMP, NULL
             );
             PRAGMA ignore_check_constraints = OFF;",
        )
        .expect("seed migration failure");

    let schema_before_failure = schema_snapshot(&mut connection);

    assert!(run_migrations(&pool).is_err(), "migration must fail");

    let mut connection = SqliteConnection::establish(temp_db.path()).expect("reconnect");
    assert_previous_schema_restored(&mut connection);
    assert_eq!(schema_snapshot(&mut connection), schema_before_failure);
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM domain_alerts WHERE id = 'alert-invalid'",
        ),
        1
    );
}

#[test]
fn recurring_migration_failure_after_schema_build_restores_previous_schema() {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert recurring migration");

    connection
        .batch_execute(
            "PRAGMA foreign_keys = OFF;
             INSERT INTO transactions (
                 id, amount, transaction_type, transaction_date, transaction_category_id,
                 created_at, updated_at
             ) VALUES (
                 'txn-orphan', 100, 'expense', CURRENT_TIMESTAMP, 'missing-category',
                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
             );
             PRAGMA foreign_keys = ON;",
        )
        .expect("seed migration failure");

    let schema_before_failure = schema_snapshot(&mut connection);

    assert!(run_migrations(&pool).is_err(), "migration must fail");

    let mut connection = SqliteConnection::establish(temp_db.path()).expect("reconnect");
    assert_previous_schema_restored(&mut connection);
    assert_eq!(schema_snapshot(&mut connection), schema_before_failure);
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM transactions WHERE id = 'txn-orphan'",
        ),
        1
    );
}

fn assert_previous_schema_restored(connection: &mut SqliteConnection) {
    assert_eq!(
        count(
            connection,
            "SELECT COUNT(*) AS count FROM __diesel_schema_migrations WHERE version = '202607202100000009'",
        ),
        0
    );
    assert_eq!(
        count(
            connection,
            "SELECT COUNT(*) AS count FROM __diesel_schema_migrations WHERE version = '202607141200000008'",
        ),
        1
    );
    assert_eq!(
        count(
            connection,
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN (
                'recurring_transactions', 'recurring_schedule_revisions',
                'recurring_template_revisions', 'recurring_occurrence_heads',
                'recurring_occurrences', 'recurring_generation_failures'
            )",
        ),
        0
    );
    assert_eq!(
        count(
            connection,
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE name LIKE '%_old'",
        ),
        0
    );
    assert_eq!(
        count(
            connection,
            "SELECT COUNT(*) AS count FROM pragma_table_info('domain_alerts')
             WHERE name IN ('updated_at', 'resolved_at')",
        ),
        0
    );
}

fn count(connection: &mut SqliteConnection, query: &str) -> i64 {
    diesel::sql_query(query)
        .get_result::<CountRow>(connection)
        .expect("count")
        .count
}

fn schema_snapshot(connection: &mut SqliteConnection) -> Vec<String> {
    diesel::sql_query(
        "SELECT type || '|' || name || '|' || COALESCE(sql, '') AS value
         FROM sqlite_master
         WHERE type IN ('table', 'index', 'trigger', 'view')
         ORDER BY type, name",
    )
    .load::<TextRow>(connection)
    .expect("schema snapshot")
    .into_iter()
    .map(|row| row.value)
    .collect()
}
