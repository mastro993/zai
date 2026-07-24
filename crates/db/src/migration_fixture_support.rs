use crate::connection::{create_pool, run_migrations};
use crate::test_utils::TempDb;
use diesel::Connection;
use diesel::RunQueryDsl;
use diesel::connection::SimpleConnection;
use diesel::prelude::QueryableByName;
use diesel::sqlite::SqliteConnection;
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) const TEST_MIGRATIONS: EmbeddedMigrations = embed_migrations!();

const FIXTURES_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/released_schemas");

#[derive(QueryableByName)]
pub(crate) struct CountRow {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    pub(crate) count: i64,
}

#[derive(QueryableByName)]
struct VersionRow {
    #[diesel(sql_type = diesel::sql_types::Text)]
    version: String,
}

#[derive(QueryableByName)]
struct NameRow {
    #[diesel(sql_type = diesel::sql_types::Text)]
    name: String,
}

#[derive(QueryableByName)]
struct SqlRow {
    #[diesel(sql_type = diesel::sql_types::Nullable<diesel::sql_types::Text>)]
    sql: Option<String>,
}

#[derive(QueryableByName)]
struct IntegrityRow {
    #[diesel(sql_type = diesel::sql_types::Text)]
    table_name: String,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    row_id: i32,
    #[diesel(sql_type = diesel::sql_types::Text)]
    parent_table: String,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    fk_index: i32,
}

#[derive(QueryableByName)]
struct QuickCheckRow {
    #[diesel(sql_type = diesel::sql_types::Text)]
    quick_check: String,
}

pub(crate) struct ReleasedSchemaFixture {
    pub(crate) name: &'static str,
    pub(crate) expected_version: &'static str,
    pub(crate) seed_sql: &'static str,
}

pub(crate) const RELEASED_SCHEMA_FIXTURES: &[ReleasedSchemaFixture] = &[
    ReleasedSchemaFixture {
        name: "v0000_initial",
        expected_version: "202509260654000000",
        seed_sql: include_str!("../fixtures/released_schemas/v0000_initial_seed.sql"),
    },
    ReleasedSchemaFixture {
        name: "v0001_category_invariants",
        expected_version: "202607051915000001",
        seed_sql: include_str!("../fixtures/released_schemas/v0001_category_invariants_seed.sql"),
    },
    ReleasedSchemaFixture {
        name: "v0002_transaction_indexes",
        expected_version: "202607081806000002",
        seed_sql: include_str!("../fixtures/released_schemas/v0002_transaction_indexes_seed.sql"),
    },
    ReleasedSchemaFixture {
        name: "v0003_category_roles",
        expected_version: "202607120900000003",
        seed_sql: include_str!("../fixtures/released_schemas/v0003_category_roles_seed.sql"),
    },
    ReleasedSchemaFixture {
        name: "v0004_budgets",
        expected_version: "202607121000000004",
        seed_sql: include_str!("../fixtures/released_schemas/v0004_budgets_seed.sql"),
    },
    ReleasedSchemaFixture {
        name: "v0005_budget_rollover_modes",
        expected_version: "202607121200000005",
        seed_sql: include_str!("../fixtures/released_schemas/v0005_budget_rollover_modes_seed.sql"),
    },
    ReleasedSchemaFixture {
        name: "v0006_budget_revisions",
        expected_version: "202607121800000006",
        seed_sql: include_str!("../fixtures/released_schemas/v0006_budget_revisions_seed.sql"),
    },
    ReleasedSchemaFixture {
        name: "v0007_budget_lifecycle",
        expected_version: "202607122000000007",
        seed_sql: include_str!("../fixtures/released_schemas/v0007_budget_lifecycle_seed.sql"),
    },
    ReleasedSchemaFixture {
        name: "v0008_domain_alerts",
        expected_version: "202607141200000008",
        seed_sql: include_str!("../fixtures/released_schemas/v0008_domain_alerts_seed.sql"),
    },
    ReleasedSchemaFixture {
        name: "v0009_recurring_transactions",
        expected_version: "202607202100000009",
        seed_sql: include_str!(
            "../fixtures/released_schemas/v0009_recurring_transactions_seed.sql"
        ),
    },
];

pub(crate) fn fixture_path(name: &str) -> PathBuf {
    Path::new(FIXTURES_DIR).join(format!("{name}.sql"))
}

pub(crate) fn load_released_schema_fixture(
    connection: &mut SqliteConnection,
    fixture_name: &str,
) -> String {
    let sql = fs::read_to_string(fixture_path(fixture_name))
        .unwrap_or_else(|err| panic!("read fixture {fixture_name}: {err}"));
    connection
        .batch_execute(&sql)
        .unwrap_or_else(|err| panic!("apply fixture {fixture_name}: {err}"));
    latest_migration_version(connection)
}

pub(crate) fn latest_migration_version(connection: &mut SqliteConnection) -> String {
    diesel::sql_query(
        "SELECT version FROM __diesel_schema_migrations ORDER BY version DESC LIMIT 1",
    )
    .get_result::<VersionRow>(connection)
    .expect("latest migration version")
    .version
}

pub(crate) fn assert_db_integrity(connection: &mut SqliteConnection) {
    let fk_violations: Vec<IntegrityRow> = diesel::sql_query("PRAGMA foreign_key_check")
        .load(connection)
        .expect("foreign key check");
    assert!(
        fk_violations.is_empty(),
        "foreign key violations: {:?}",
        fk_violations
            .iter()
            .map(|row| format!(
                "{} row {} parent {} fk {}",
                row.table_name, row.row_id, row.parent_table, row.fk_index
            ))
            .collect::<Vec<_>>()
    );

    let quick_check = diesel::sql_query("PRAGMA quick_check")
        .get_result::<QuickCheckRow>(connection)
        .expect("quick check");
    assert_eq!(quick_check.quick_check, "ok");
}

pub(crate) fn migrate_fixture_to_head(temp_db: &TempDb) -> SqliteConnection {
    let pool = create_pool(Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrate to head");
    SqliteConnection::establish(temp_db.path()).expect("connect after migrate")
}

pub(crate) fn setup_fixture_at_version(
    fixture: &ReleasedSchemaFixture,
) -> (TempDb, SqliteConnection, String) {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    let version = load_released_schema_fixture(&mut connection, fixture.name);
    connection
        .batch_execute(fixture.seed_sql)
        .unwrap_or_else(|err| panic!("seed fixture {}: {err}", fixture.name));
    (temp_db, connection, version)
}

pub(crate) fn has_temp_old_tables(connection: &mut SqliteConnection) -> bool {
    diesel::sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master \
         WHERE type = 'table' AND name LIKE '%_old'",
    )
    .get_result::<CountRow>(connection)
    .expect("temp old tables")
    .count
        > 0
}

#[cfg(test)]
mod generator {
    use super::*;

    const FRONTIER_VERSIONS: &[(&str, &str)] = &[
        ("v0000_initial", "202509260654000000"),
        ("v0001_category_invariants", "202607051915000001"),
        ("v0002_transaction_indexes", "202607081806000002"),
        ("v0003_category_roles", "202607120900000003"),
        ("v0004_budgets", "202607121000000004"),
        ("v0005_budget_rollover_modes", "202607121200000005"),
        ("v0006_budget_revisions", "202607121800000006"),
        ("v0007_budget_lifecycle", "202607122000000007"),
        ("v0008_domain_alerts", "202607141200000008"),
        ("v0009_recurring_transactions", "202607202100000009"),
    ];

    #[test]
    fn migration_version_labels() {
        let temp_db = TempDb::new();
        let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
        connection
            .run_pending_migrations(TEST_MIGRATIONS)
            .expect("apply all migrations");
        let versions: Vec<VersionRow> =
            diesel::sql_query("SELECT version FROM __diesel_schema_migrations ORDER BY version")
                .load(&mut connection)
                .expect("versions");
        assert_eq!(versions.len(), 10);
        assert_eq!(versions[3].version, "202607120900000003");
        assert_eq!(versions[4].version, "202607121000000004");
        assert_eq!(versions[5].version, "202607121200000005");
        assert_eq!(versions[7].version, "202607122000000007");
    }

    #[test]
    #[ignore = "maintainer-only fixture generator"]
    fn write_released_schema_fixtures() {
        fs::create_dir_all(FIXTURES_DIR).expect("fixtures dir");

        for (name, target_version) in FRONTIER_VERSIONS {
            let temp_db = TempDb::new();
            let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
            connection
                .run_pending_migrations(TEST_MIGRATIONS)
                .expect("apply all migrations");

            while latest_migration_version(&mut connection) != *target_version {
                connection
                    .revert_last_migration(TEST_MIGRATIONS)
                    .expect("revert to frontier");
            }

            let dump = dump_database_schema(&mut connection);
            let output_path = fixture_path(name);
            fs::write(&output_path, dump).expect("write fixture");
        }
    }

    fn dump_database_schema(connection: &mut SqliteConnection) -> String {
        let mut statements = vec![
            "PRAGMA foreign_keys = OFF;".to_string(),
            "BEGIN;".to_string(),
        ];

        let table_names: Vec<String> = diesel::sql_query(
            "SELECT name FROM sqlite_master \
             WHERE type = 'table' AND name NOT LIKE 'sqlite_%' \
             ORDER BY name",
        )
        .load::<NameRow>(connection)
        .expect("table names")
        .into_iter()
        .map(|row| row.name)
        .collect();

        for table_name in table_names {
            let create_sql: SqlRow = diesel::sql_query(format!(
                "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '{table_name}'"
            ))
            .get_result(connection)
            .expect("table ddl");

            statements.push(format!("DROP TABLE IF EXISTS \"{table_name}\";"));
            if let Some(sql) = create_sql.sql {
                statements.push(format!("{sql};"));
            }
        }

        let index_names: Vec<String> = diesel::sql_query(
            "SELECT name FROM sqlite_master \
             WHERE type = 'index' AND name NOT LIKE 'sqlite_%' \
             ORDER BY name",
        )
        .load::<NameRow>(connection)
        .expect("index names")
        .into_iter()
        .map(|row| row.name)
        .collect();

        for index_name in index_names {
            let create_sql: SqlRow = diesel::sql_query(format!(
                "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = '{index_name}'"
            ))
            .get_result(connection)
            .expect("index ddl");

            if let Some(sql) = create_sql.sql {
                statements.push(format!("DROP INDEX IF EXISTS \"{index_name}\";"));
                statements.push(format!("{sql};"));
            }
        }

        let migration_versions: Vec<String> =
            diesel::sql_query("SELECT version FROM __diesel_schema_migrations ORDER BY version")
                .load::<VersionRow>(connection)
                .expect("migration versions")
                .into_iter()
                .map(|row| row.version)
                .collect();

        for version in migration_versions {
            statements.push(format!(
                "INSERT INTO __diesel_schema_migrations (version) VALUES ('{version}');"
            ));
        }

        statements.push("COMMIT;".to_string());
        statements.push("PRAGMA foreign_keys = ON;".to_string());
        statements.join("\n")
    }
}
