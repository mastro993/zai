use crate::connection::{create_pool, run_migrations};
use crate::migration_fixture_support::TEST_MIGRATIONS;
use crate::test_utils::TempDb;
use diesel::Connection;
use diesel::RunQueryDsl;
use diesel::prelude::QueryableByName;
use diesel::sqlite::SqliteConnection;
use diesel_migrations::MigrationHarness;

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    count: i64,
}

#[derive(QueryableByName)]
struct TextRow {
    #[diesel(sql_type = diesel::sql_types::Text)]
    value: String,
}

#[test]
fn recurring_description_migration_backfills_blank_templates_before_dropping_names() {
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
            'rt-backfill', '  Legacy label  ', 'active', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP\
         )",
    )
    .execute(&mut connection)
    .expect("seed recurring");
    diesel::sql_query(
        "INSERT INTO recurring_template_revisions (\
            id, recurring_transaction_id, sequence, effective_from_local, description, amount, transaction_type\
         ) VALUES (\
            'tmpl-backfill', 'rt-backfill', 1, CURRENT_TIMESTAMP, '   ', 100, 'expense'\
         )",
    )
    .execute(&mut connection)
    .expect("seed template");

    run_migrations(&pool).expect("apply recurring description migration");

    let description = diesel::sql_query(
        "SELECT description AS value FROM recurring_template_revisions WHERE id = 'tmpl-backfill'",
    )
    .get_result::<TextRow>(&mut connection)
    .expect("backfilled description");
    assert_eq!(description.value, "Legacy label");

    let name_column_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM pragma_table_info('recurring_transactions') WHERE name = 'name'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("name column");
    assert_eq!(name_column_count.count, 0);
}
