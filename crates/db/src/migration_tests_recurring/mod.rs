mod schema_tests;
mod upgrade_tests;

use crate::connection::{create_pool, run_migrations_with_zone_provider};
use crate::migration_fixture_support::{CountRow, TEST_MIGRATIONS};
use crate::test_utils::TempDb;
use chrono::NaiveDateTime;
use diesel::Connection;
use diesel::RunQueryDsl;
use diesel::connection::SimpleConnection;
use diesel::prelude::QueryableByName;
use diesel::sqlite::SqliteConnection;
use diesel_migrations::MigrationHarness;
use std::sync::Arc;
use zai_core::time::{DeviceZoneProvider, FixedDeviceZoneProvider, IanaZone};

const CURRENT_POPULATED_SEED: &str =
    include_str!("../../fixtures/released_schemas/current_populated_seed.sql");
const ROME: &str = "Europe/Rome";

const RECURRING_TABLES: &[&str] = &[
    "recurring_transactions",
    "recurring_schedule_revisions",
    "recurring_template_revisions",
    "recurring_occurrence_heads",
    "recurring_occurrences",
    "recurring_generation_failures",
];

struct FailingZoneProvider;

impl DeviceZoneProvider for FailingZoneProvider {
    fn current_zone(&self) -> zai_core::Result<IanaZone> {
        Err(zai_core::Error::InvalidData(
            "Device time zone unavailable".to_string(),
        ))
    }
}

fn rome_provider() -> Arc<dyn DeviceZoneProvider> {
    Arc::new(FixedDeviceZoneProvider::new(
        IanaZone::parse(ROME).expect("zone"),
    ))
}

fn migrate(temp_db: &TempDb, provider: Arc<dyn DeviceZoneProvider>) -> zai_core::Result<()> {
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations_with_zone_provider(&pool, provider)
}

fn setup_current_populated() -> (TempDb, SqliteConnection) {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    connection
        .run_pending_migrations(TEST_MIGRATIONS)
        .expect("diesel migrations");
    connection
        .batch_execute(CURRENT_POPULATED_SEED)
        .expect("seed current populated fixture");
    (temp_db, connection)
}

fn user_version(conn: &mut SqliteConnection) -> i32 {
    #[derive(QueryableByName)]
    struct Row {
        #[diesel(sql_type = diesel::sql_types::Integer)]
        user_version: i32,
    }
    diesel::sql_query("PRAGMA user_version")
        .get_result::<Row>(conn)
        .expect("user_version")
        .user_version
}

fn count(conn: &mut SqliteConnection, sql: &str) -> i64 {
    diesel::sql_query(sql.to_string())
        .get_result::<CountRow>(conn)
        .expect("count")
        .count
}

fn table_exists(conn: &mut SqliteConnection, table: &str) -> bool {
    count(
        conn,
        &format!(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = '{table}'"
        ),
    ) > 0
}

fn column_exists(conn: &mut SqliteConnection, table: &str, column: &str) -> bool {
    count(
        conn,
        &format!(
            "SELECT COUNT(*) AS count FROM pragma_table_info('{table}') WHERE name = '{column}'"
        ),
    ) > 0
}

fn scalar_text(conn: &mut SqliteConnection, sql: &str) -> String {
    #[derive(QueryableByName)]
    struct Row {
        #[diesel(sql_type = diesel::sql_types::Text)]
        value: String,
    }
    diesel::sql_query(sql.to_string())
        .get_result::<Row>(conn)
        .expect("scalar text")
        .value
}

fn parse_datetime(value: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S"))
        .unwrap_or_else(|err| panic!("parse datetime {value}: {err}"))
}
