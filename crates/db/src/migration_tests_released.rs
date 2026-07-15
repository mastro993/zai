use crate::connection::{create_pool, run_migrations};
use crate::migration_fixture_support::{
    CountRow, RELEASED_SCHEMA_FIXTURES, TEST_MIGRATIONS, assert_db_integrity, has_temp_old_tables,
    latest_migration_version, migrate_fixture_to_head, setup_fixture_at_version,
};
use diesel::Connection;
use diesel::RunQueryDsl;
use diesel::sqlite::SqliteConnection;
use diesel_migrations::MigrationHarness;

#[test]
fn released_schema_fixtures_load_at_expected_version() {
    for fixture in RELEASED_SCHEMA_FIXTURES {
        let (_temp_db, _connection, version) = setup_fixture_at_version(fixture);
        assert_eq!(version, fixture.expected_version, "{}", fixture.name);
    }
}

#[test]
fn released_schema_fixtures_upgrade_to_head() {
    for fixture in RELEASED_SCHEMA_FIXTURES {
        let (temp_db, mut connection, _) = setup_fixture_at_version(fixture);

        let category_count_before = count_rows(&mut connection, "transaction_categories");
        let transaction_count_before = count_rows(&mut connection, "transactions");
        let budget_count_before = count_rows(&mut connection, "budgets");
        let configuration_count_before = count_rows(&mut connection, "budget_configurations");
        let result_count_before = count_rows(&mut connection, "budget_period_results");

        let mut connection = migrate_fixture_to_head(&temp_db);
        assert_db_integrity(&mut connection);

        let migration_count =
            diesel::sql_query("SELECT COUNT(*) AS count FROM __diesel_schema_migrations")
                .get_result::<CountRow>(&mut connection)
                .expect("migration history");
        assert_eq!(migration_count.count, 10, "{}", fixture.name);

        let invalid_category_colors = diesel::sql_query(
            "SELECT COUNT(*) AS count FROM transaction_categories \
             WHERE color IS NOT NULL AND (length(color) != 7 OR color NOT GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')",
        )
        .get_result::<CountRow>(&mut connection)
        .expect("valid category colors");
        assert_eq!(invalid_category_colors.count, 0, "{}", fixture.name);

        if fixture.name == "v0003_category_roles" {
            let normalized_legacy_color = diesel::sql_query(
                "SELECT COUNT(*) AS count FROM transaction_categories \
                 WHERE id = 'cat-root' AND color IS NULL",
            )
            .get_result::<CountRow>(&mut connection)
            .expect("normalized legacy category color");
            assert_eq!(normalized_legacy_color.count, 1);
        }

        assert_eq!(
            count_rows(&mut connection, "transaction_categories"),
            category_count_before,
            "{} categories",
            fixture.name
        );
        assert_eq!(
            count_rows(&mut connection, "transactions"),
            transaction_count_before,
            "{} transactions",
            fixture.name
        );
        assert_eq!(
            count_rows(&mut connection, "budgets"),
            budget_count_before,
            "{} budgets",
            fixture.name
        );
        assert_eq!(
            count_rows(&mut connection, "budget_configurations"),
            configuration_count_before,
            "{} configurations",
            fixture.name
        );
        assert_eq!(
            count_rows(&mut connection, "budget_period_results"),
            result_count_before,
            "{} period results",
            fixture.name
        );

        let domain_alert_table_count = diesel::sql_query(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'domain_alerts'",
        )
        .get_result::<CountRow>(&mut connection)
        .expect("domain alerts table");
        assert_eq!(domain_alert_table_count.count, 1, "{}", fixture.name);

        if fixture.name == "v0007_budget_lifecycle" {
            let paused_column_count = diesel::sql_query(
                "SELECT COUNT(*) AS count FROM pragma_table_info('budgets') WHERE name = 'paused'",
            )
            .get_result::<CountRow>(&mut connection)
            .expect("paused column");
            let revision_column_count = diesel::sql_query(
                "SELECT COUNT(*) AS count FROM pragma_table_info('budgets') WHERE name = 'revision'",
            )
            .get_result::<CountRow>(&mut connection)
            .expect("revision column");
            assert_eq!(paused_column_count.count, 1);
            assert_eq!(revision_column_count.count, 1);
        }
    }
}

#[test]
fn rollover_downgrade_normalizes_populated_non_off_rows() {
    let fixture = RELEASED_SCHEMA_FIXTURES
        .iter()
        .find(|fixture| fixture.name == "v0005_budget_rollover_modes")
        .expect("rollover fixture");
    let (temp_db, mut connection, version) = setup_fixture_at_version(fixture);
    assert_eq!(version, "202607121200000005");

    let budget_count_before = count_rows(&mut connection, "budgets");
    let configuration_count_before = count_rows(&mut connection, "budget_configurations");
    let result_count_before = count_rows(&mut connection, "budget_period_results");
    let non_off_before =
        diesel::sql_query("SELECT COUNT(*) AS count FROM budgets WHERE rollover_mode != 'off'")
            .get_result::<CountRow>(&mut connection)
            .expect("non-off budgets");
    assert_eq!(non_off_before.count, 2);

    connection
        .revert_last_migration(TEST_MIGRATIONS)
        .expect("revert rollover migration");

    assert!(!has_temp_old_tables(&mut connection));
    assert_db_integrity(&mut connection);
    assert_eq!(
        latest_migration_version(&mut connection),
        "202607121000000004"
    );

    assert_eq!(count_rows(&mut connection, "budgets"), budget_count_before);
    assert_eq!(
        count_rows(&mut connection, "budget_configurations"),
        configuration_count_before
    );
    assert_eq!(
        count_rows(&mut connection, "budget_period_results"),
        result_count_before
    );

    let normalized_budgets =
        diesel::sql_query("SELECT COUNT(*) AS count FROM budgets WHERE rollover_mode = 'off'")
            .get_result::<CountRow>(&mut connection)
            .expect("normalized budgets");
    let normalized_configurations = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM budget_configurations WHERE rollover_mode = 'off'",
    )
    .get_result::<CountRow>(&mut connection)
    .expect("normalized configurations");
    assert_eq!(normalized_budgets.count, budget_count_before);
    assert_eq!(normalized_configurations.count, configuration_count_before);

    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("re-apply rollover migration");
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("reconnect");
    assert_db_integrity(&mut connection);
    let restored_non_off =
        diesel::sql_query("SELECT COUNT(*) AS count FROM budgets WHERE rollover_mode != 'off'")
            .get_result::<CountRow>(&mut connection)
            .expect("restored non-off budgets");
    assert_eq!(restored_non_off.count, 0);
}

fn count_rows(connection: &mut SqliteConnection, table_name: &str) -> i64 {
    if table_exists(connection, table_name) {
        diesel::sql_query(format!("SELECT COUNT(*) AS count FROM {table_name}"))
            .get_result::<CountRow>(connection)
            .expect("row count")
            .count
    } else {
        0
    }
}

fn table_exists(connection: &mut SqliteConnection, table_name: &str) -> bool {
    diesel::sql_query(format!(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = '{table_name}'"
    ))
    .get_result::<CountRow>(connection)
    .expect("table exists")
    .count
        > 0
}
