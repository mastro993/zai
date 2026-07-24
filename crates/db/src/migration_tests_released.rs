use crate::connection::{create_pool, run_migrations};
use crate::migration_fixture_support::{
    CountRow, RELEASED_SCHEMA_FIXTURES, TEST_MIGRATIONS, assert_db_integrity, has_temp_old_tables,
    latest_migration_version, migrate_fixture_to_head, setup_fixture_at_version,
};
use diesel::Connection;
use diesel::RunQueryDsl;
use diesel::prelude::QueryableByName;
use diesel::sqlite::SqliteConnection;
use diesel_migrations::MigrationHarness;

#[derive(QueryableByName)]
struct TextRow {
    #[diesel(sql_type = diesel::sql_types::Text)]
    value: String,
}

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
        let fixture_data_before = fixture_data_snapshot(&mut connection, fixture.name);

        let mut connection = migrate_fixture_to_head(&temp_db);
        assert_db_integrity(&mut connection);

        let migration_count =
            diesel::sql_query("SELECT COUNT(*) AS count FROM __diesel_schema_migrations")
                .get_result::<CountRow>(&mut connection)
                .expect("migration history");
        assert_eq!(migration_count.count, 10, "{}", fixture.name);

        assert_eq!(
            fixture_data_snapshot(&mut connection, fixture.name),
            fixture_data_before,
            "{} finance data",
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

fn fixture_data_snapshot(
    connection: &mut SqliteConnection,
    fixture_name: &str,
) -> Vec<Vec<String>> {
    let category_query = if matches!(
        fixture_name,
        "v0000_initial" | "v0001_category_invariants" | "v0002_transaction_indexes"
    ) {
        "SELECT quote(id) || '|' || quote(parent_id) || '|' || quote(name) || '|' ||
         quote(description) || '|' || quote(color) || '|' || quote('spending') || '|' ||
         quote(created_at) || '|' || quote(updated_at) || '|' || quote(deleted_at) AS value
         FROM transaction_categories ORDER BY id"
    } else {
        "SELECT quote(id) || '|' || quote(parent_id) || '|' || quote(name) || '|' ||
         quote(description) || '|' || quote(color) || '|' || quote(role) || '|' ||
         quote(created_at) || '|' || quote(updated_at) || '|' || quote(deleted_at) AS value
         FROM transaction_categories ORDER BY id"
    };
    let mut snapshots = vec![
        snapshot_rows(connection, category_query),
        snapshot_rows(
            connection,
            "SELECT quote(id) || '|' || quote(description) || '|' || quote(amount) || '|' ||
             quote(transaction_date) || '|' || quote(transaction_type) || '|' ||
             quote(transaction_category_id) || '|' || quote(notes) || '|' || quote(created_at) ||
             '|' || quote(updated_at) || '|' || quote(deleted_at) AS value
             FROM transactions ORDER BY id",
        ),
    ];

    if table_exists(connection, "budgets") {
        let budget_query = if matches!(
            fixture_name,
            "v0007_budget_lifecycle" | "v0008_domain_alerts" | "v0009_recurring_transactions"
        ) {
            "SELECT quote(id) || '|' || quote(name) || '|' || quote(cadence) || '|' ||
             quote(measurement_mode) || '|' || quote(base_allowance) || '|' ||
             quote(rollover_mode) || '|' || quote(warning_percentage) || '|' || quote(revision) ||
             '|' || quote(paused) || '|' || quote(created_at) || '|' || quote(updated_at) ||
             '|' || quote(deleted_at) AS value FROM budgets ORDER BY id"
        } else if fixture_name == "v0006_budget_revisions" {
            "SELECT quote(id) || '|' || quote(name) || '|' || quote(cadence) || '|' ||
             quote(measurement_mode) || '|' || quote(base_allowance) || '|' ||
             quote(rollover_mode) || '|' || quote(warning_percentage) || '|' || quote(revision) ||
             '|' || quote(created_at) || '|' || quote(updated_at) || '|' || quote(deleted_at) AS value
             FROM budgets ORDER BY id"
        } else {
            "SELECT quote(id) || '|' || quote(name) || '|' || quote(cadence) || '|' ||
             quote(measurement_mode) || '|' || quote(base_allowance) || '|' ||
             quote(rollover_mode) || '|' || quote(warning_percentage) || '|' ||
             quote(created_at) || '|' || quote(updated_at) || '|' || quote(deleted_at) AS value
             FROM budgets ORDER BY id"
        };
        snapshots.push(snapshot_rows(connection, budget_query));
    } else {
        snapshots.push(Vec::new());
    }
    if table_exists(connection, "budget_configurations") {
        snapshots.push(snapshot_rows(
            connection,
            "SELECT quote(budget_id) || '|' || quote(period_start) || '|' || quote(period_end) ||
             '|' || quote(category_ids) || '|' || quote(base_allowance) || '|' ||
             quote(measurement_mode) || '|' || quote(rollover_mode) || '|' ||
             quote(warning_percentage) AS value FROM budget_configurations
             ORDER BY budget_id, period_start",
        ));
    } else {
        snapshots.push(Vec::new());
    }
    if table_exists(connection, "budget_period_results") {
        snapshots.push(snapshot_rows(
            connection,
            "SELECT quote(budget_id) || '|' || quote(period_start) || '|' || quote(period_end) ||
             '|' || quote(net_budget_spending) || '|' || quote(effective_allowance) || '|' ||
             quote(remaining_allowance) || '|' || quote(status) AS value
             FROM budget_period_results ORDER BY budget_id, period_start",
        ));
    } else {
        snapshots.push(Vec::new());
    }

    if table_exists(connection, "domain_alerts") {
        let domain_alert_query = if fixture_name == "v0009_recurring_transactions" {
            "SELECT quote(id) || '|' || quote(producer_key) || '|' || quote(occurrence_key) ||
             '|' || quote(severity) || '|' || quote(title) || '|' || quote(body) || '|' ||
             quote(destination) || '|' || quote(data) || '|' || quote(created_at) || '|' ||
             quote(updated_at) || '|' || quote(read_at) || '|' || quote(resolved_at) AS value
             FROM domain_alerts ORDER BY id"
        } else {
            "SELECT quote(id) || '|' || quote(producer_key) || '|' || quote(occurrence_key) ||
             '|' || quote(severity) || '|' || quote(title) || '|' || quote(body) || '|' ||
             quote(destination) || '|' || quote(data) || '|' || quote(created_at) || '|' ||
             quote(created_at) || '|' || quote(read_at) || '|' || quote(NULL) AS value
             FROM domain_alerts ORDER BY id"
        };
        snapshots.push(snapshot_rows(connection, domain_alert_query));
    } else {
        snapshots.push(Vec::new());
    }

    if table_exists(connection, "recurring_transactions") {
        snapshots.push(snapshot_rows(
            connection,
            "SELECT quote(id) || '|' || quote(lifecycle) || '|' || quote(total_occurrences) ||
             '|' || quote(fulfilled_count) || '|' || quote(revision) || '|' ||
             quote(lifecycle_changed_at) || '|' || quote(paused_at) || '|' || quote(created_at) ||
             '|' || quote(updated_at) || '|' || quote(deleted_at) AS value
             FROM recurring_transactions ORDER BY id",
        ));
        snapshots.push(snapshot_rows(
            connection,
            "SELECT quote(id) || '|' || quote(recurring_transaction_id) || '|' || quote(sequence) ||
             '|' || quote(effective_from_local) || '|' || quote(effective_until_local) || '|' ||
             quote(first_scheduled_local) || '|' || quote(interval_every) || '|' ||
             quote(interval_unit) || '|' || quote(monthly_day) AS value
             FROM recurring_schedule_revisions ORDER BY id",
        ));
        snapshots.push(snapshot_rows(
            connection,
            "SELECT quote(id) || '|' || quote(recurring_transaction_id) || '|' || quote(sequence) ||
             '|' || quote(effective_from_local) || '|' || quote(effective_until_local) || '|' ||
             quote(description) || '|' || quote(amount) || '|' || quote(transaction_type) ||
             '|' || quote(transaction_category_id) || '|' || quote(notes) AS value
             FROM recurring_template_revisions ORDER BY id",
        ));
        snapshots.push(snapshot_rows(
            connection,
            "SELECT quote(recurring_transaction_id) || '|' || quote(schedule_revision_id) ||
             '|' || quote(next_ordinal) || '|' || quote(next_scheduled_local) AS value
             FROM recurring_occurrence_heads ORDER BY recurring_transaction_id",
        ));
    } else {
        snapshots.extend([Vec::new(), Vec::new(), Vec::new(), Vec::new()]);
    }
    snapshots
}

fn snapshot_rows(connection: &mut SqliteConnection, query: &str) -> Vec<String> {
    diesel::sql_query(query)
        .load::<TextRow>(connection)
        .expect("snapshot rows")
        .into_iter()
        .map(|row| row.value)
        .collect()
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
