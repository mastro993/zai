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
            'rt-backfill', '  Legacy label  ', 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP\
         )",
    )
    .execute(&mut connection)
    .expect("seed recurring");
    diesel::sql_query(
        "INSERT INTO recurring_schedule_revisions (\
            id, recurring_transaction_id, sequence, effective_from_local, first_scheduled_local,\
            interval_every, interval_unit\
         ) VALUES (\
            'sch-backfill', 'rt-backfill', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, 'month'\
         )",
    )
    .execute(&mut connection)
    .expect("seed schedule");
    diesel::sql_query(
        "INSERT INTO recurring_template_revisions (\
            id, recurring_transaction_id, sequence, effective_from_local, description, amount, transaction_type\
         ) VALUES (\
            'tmpl-backfill', 'rt-backfill', 1, CURRENT_TIMESTAMP, '   ', 100, 'expense'\
         )",
    )
    .execute(&mut connection)
    .expect("seed template");
    diesel::sql_query(
        "INSERT INTO transactions (\
            id, amount, transaction_type, transaction_date, description, created_at, updated_at\
         ) VALUES (\
            'txn-backfill', 100, 'expense', CURRENT_TIMESTAMP, 'Legacy label', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP\
         )",
    )
    .execute(&mut connection)
    .expect("seed transaction");
    diesel::sql_query(
        "INSERT INTO domain_alerts (\
            id, producer_key, occurrence_key, severity, title, body, created_at, updated_at\
         ) VALUES (\
            'alert-backfill', 'recurring.occurrence', 'rt-backfill|sch-backfill|1', 'info',\
            'title', 'body', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP\
         )",
    )
    .execute(&mut connection)
    .expect("seed alert");
    diesel::sql_query(
        "INSERT INTO recurring_occurrences (\
            recurring_transaction_id, schedule_revision_id, ordinal, scheduled_local,\
            template_revision_id, fulfilled_at, fulfillment_position, transaction_id,\
            fulfillment_kind, recurring_alert_id\
         ) VALUES (\
            'rt-backfill', 'sch-backfill', 1, CURRENT_TIMESTAMP, 'tmpl-backfill', CURRENT_TIMESTAMP,\
            1, 'txn-backfill', 'generated', 'alert-backfill'\
         )",
    )
    .execute(&mut connection)
    .expect("seed occurrence");

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

    let occurrence_count = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM recurring_occurrences WHERE recurring_transaction_id = 'rt-backfill'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("occurrence survived");
    assert_eq!(occurrence_count.count, 1);
}
