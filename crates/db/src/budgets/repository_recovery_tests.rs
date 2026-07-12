use super::setup;
use crate::test_utils::TempDb;
use diesel::{Connection, RunQueryDsl, SqliteConnection, sql_query};
use zai_core::features::budgets::traits::BudgetsRepositoryTrait;

#[tokio::test]
async fn listing_budget_recovers_when_projection_configuration_is_missing() {
    let temp_db = TempDb::new();
    let (budgets, _, _) = setup(&temp_db);
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");

    sql_query(
        "INSERT INTO budgets (
            id, name, cadence, measurement_mode, base_allowance, rollover_mode,
            warning_percentage, created_at, updated_at
        ) VALUES (
            'orphan-budget', 'Orphan budget', 'month', 'spending', 10000, 'off',
            80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )",
    )
    .execute(&mut conn)
    .expect("orphan budget");

    let listed = budgets
        .list_budgets()
        .await
        .expect("orphan budget should be recovered");

    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, "orphan-budget");
    assert_eq!(listed[0].current_period.base_allowance, 10_000);
}
