use super::{
    FailingZoneProvider, RECURRING_TABLES, ROME, column_exists, count, migrate, parse_datetime,
    rome_provider, scalar_text, setup_current_populated, table_exists, user_version,
};
use crate::migration_fixture_support::{
    RELEASED_SCHEMA_FIXTURES, assert_db_integrity, has_temp_old_tables, setup_fixture_at_version,
};
use diesel::Connection;
use diesel::RunQueryDsl;
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::time::IanaZone;

#[test]
fn released_fixtures_upgrade_converts_wall_times_and_periods() {
    for fixture in RELEASED_SCHEMA_FIXTURES {
        let (temp_db, mut connection, _) = setup_fixture_at_version(fixture);
        let wall = parse_datetime("2026-07-15 08:30:00");
        diesel::sql_query(
            "INSERT INTO transactions (id, amount, transaction_date, transaction_type, created_at, updated_at) \
             VALUES ('txn-wall', 999, '2026-07-15 08:30:00', 'expense', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        )
        .execute(&mut connection)
        .expect("seed wall transaction");
        let budget_count_before = if table_exists(&mut connection, "budgets") {
            count(&mut connection, "SELECT COUNT(*) AS count FROM budgets")
        } else {
            0
        };
        drop(connection);

        migrate(&temp_db, rome_provider()).unwrap_or_else(|err| {
            panic!("{} migrate to head: {err:?}", fixture.name);
        });
        let mut conn = SqliteConnection::establish(temp_db.path()).expect("reconnect");

        assert_eq!(user_version(&mut conn), 1, "{}", fixture.name);
        assert!(!has_temp_old_tables(&mut conn), "{}", fixture.name);
        assert_db_integrity(&mut conn);

        let stored = parse_datetime(&scalar_text(
            &mut conn,
            "SELECT transaction_date AS value FROM transactions WHERE id = 'txn-wall'",
        ));
        let zone_name = scalar_text(
            &mut conn,
            "SELECT time_zone AS value FROM transactions WHERE id = 'txn-wall'",
        );
        assert_eq!(zone_name, ROME, "{}", fixture.name);
        assert_ne!(stored, wall, "{} must store UTC", fixture.name);
        let projected = crate::tz::utc_to_wall(stored, &zone_name).expect("project wall");
        assert_eq!(projected, wall, "{} wall projection", fixture.name);

        if budget_count_before > 0 {
            assert_eq!(
                count(&mut conn, "SELECT COUNT(*) AS count FROM budgets"),
                budget_count_before,
                "{}",
                fixture.name
            );
            let zones = count(
                &mut conn,
                &format!("SELECT COUNT(*) AS count FROM budgets WHERE time_zone = '{ROME}'"),
            );
            assert_eq!(zones, budget_count_before, "{}", fixture.name);
            let bad_periods = count(
                &mut conn,
                "SELECT COUNT(*) AS count FROM budget_configurations \
                 WHERE period_start != date(period_start) OR period_end != date(period_end)",
            );
            assert_eq!(bad_periods, 0, "{} DATE periods", fixture.name);
        }
    }
}

#[test]
fn current_populated_fixture_upgrades_and_retains_data() {
    let (temp_db, mut connection) = setup_current_populated();
    let transaction_count = count(
        &mut connection,
        "SELECT COUNT(*) AS count FROM transactions",
    );
    let alert_count = count(
        &mut connection,
        "SELECT COUNT(*) AS count FROM domain_alerts",
    );
    drop(connection);

    migrate(&temp_db, rome_provider()).expect("migrate populated fixture");
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("reconnect");

    assert_eq!(user_version(&mut conn), 1);
    assert_db_integrity(&mut conn);
    assert_eq!(
        count(&mut conn, "SELECT COUNT(*) AS count FROM transactions"),
        transaction_count
    );
    assert_eq!(
        count(&mut conn, "SELECT COUNT(*) AS count FROM domain_alerts"),
        alert_count
    );

    let zone = IanaZone::parse(ROME).expect("zone");
    for (id, wall) in [
        ("txn-morning", "2026-07-15 08:30:00"),
        ("txn-midnight", "2026-07-01 00:00:00"),
        ("txn-dst-gap", "2026-03-29 02:30:00"),
        ("txn-deleted", "2026-06-30 22:15:00"),
    ] {
        let stored = parse_datetime(&scalar_text(
            &mut conn,
            &format!("SELECT transaction_date AS value FROM transactions WHERE id = '{id}'"),
        ));
        let expected = zai_core::time::resolve_local_datetime_to_utc(parse_datetime(wall), &zone)
            .expect("resolve")
            .naive_utc();
        assert_eq!(stored, expected, "{id} UTC conversion");
    }

    let july_start = scalar_text(
        &mut conn,
        "SELECT period_start AS value FROM budget_configurations \
         WHERE budget_id = 'budget-food' ORDER BY period_start DESC LIMIT 1",
    );
    let july_end = scalar_text(
        &mut conn,
        "SELECT period_end AS value FROM budget_configurations \
         WHERE budget_id = 'budget-food' ORDER BY period_start DESC LIMIT 1",
    );
    assert_eq!(july_start, "2026-07-01");
    assert_eq!(
        july_end, "2026-08-01",
        "half-open end recomputed from cadence"
    );
    assert_eq!(
        count(
            &mut conn,
            "SELECT COUNT(*) AS count FROM budget_period_results WHERE period_end != date(period_start, '+1 month')",
        ),
        0
    );

    let alerts_with_init = count(
        &mut conn,
        "SELECT COUNT(*) AS count FROM domain_alerts \
         WHERE updated_at = created_at AND resolved_at IS NULL",
    );
    assert_eq!(alerts_with_init, alert_count);
    let read_preserved = count(
        &mut conn,
        "SELECT COUNT(*) AS count FROM domain_alerts \
         WHERE id = 'alert-read' AND read_at IS NOT NULL",
    );
    assert_eq!(read_preserved, 1);
}

#[test]
fn missing_zone_fails_and_rolls_back_then_retry_succeeds() {
    let (temp_db, mut connection) = setup_current_populated();
    let transaction_count = count(
        &mut connection,
        "SELECT COUNT(*) AS count FROM transactions",
    );
    drop(connection);

    migrate(&temp_db, Arc::new(FailingZoneProvider)).expect_err("missing zone must fail");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("reconnect");
    assert_eq!(user_version(&mut conn), 0);
    for table in RECURRING_TABLES {
        assert!(!table_exists(&mut conn, table), "partial schema: {table}");
    }
    assert!(!column_exists(&mut conn, "transactions", "time_zone"));
    assert!(!has_temp_old_tables(&mut conn));
    assert_eq!(
        count(&mut conn, "SELECT COUNT(*) AS count FROM transactions"),
        transaction_count
    );
    drop(conn);

    migrate(&temp_db, rome_provider()).expect("retry with valid zone");
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("reconnect");
    assert_eq!(user_version(&mut conn), 1);
    assert!(column_exists(&mut conn, "transactions", "time_zone"));
    assert_db_integrity(&mut conn);
}

#[test]
fn conversion_failure_rolls_back_and_restart_retries_whole_migration() {
    let (temp_db, mut connection) = setup_current_populated();
    diesel::sql_query(
        "INSERT INTO transactions (id, amount, transaction_date, transaction_type, created_at, updated_at) \
         VALUES ('txn-corrupt', 1, 'not-a-date', 'expense', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    )
    .execute(&mut connection)
    .expect("seed corrupt transaction");
    drop(connection);

    migrate(&temp_db, rome_provider()).expect_err("corrupt date must abort conversion");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("reconnect");
    assert_eq!(user_version(&mut conn), 0);
    assert!(!column_exists(&mut conn, "transactions", "time_zone"));
    assert!(!table_exists(&mut conn, "recurring_transactions"));
    assert!(!has_temp_old_tables(&mut conn));

    diesel::sql_query(
        "UPDATE transactions SET transaction_date = '2026-07-15 10:00:00' WHERE id = 'txn-corrupt'",
    )
    .execute(&mut conn)
    .expect("repair corrupt row");
    drop(conn);

    migrate(&temp_db, rome_provider()).expect("restart retries whole migration");
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("reconnect");
    assert_eq!(user_version(&mut conn), 1);
    assert_db_integrity(&mut conn);
}
