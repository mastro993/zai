use super::setup;
use crate::test_utils::TempDb;
use diesel::{Connection, RunQueryDsl, SqliteConnection, sql_query};
use zai_core::features::budgets::models::NewBudget;
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

#[tokio::test]
async fn history_rebuilds_when_a_projected_result_is_missing() {
    let temp_db = TempDb::new();
    let (budgets, _, _) = setup(&temp_db);
    budgets
        .create_budget(NewBudget {
            id: Some("missing-result".to_string()),
            name: "Missing result".to_string(),
            base_allowance: 10_000,
            cadence: None,
            category_ids: Vec::new(),
            measurement_mode: None,
            rollover_mode: None,
            warning_percentage: Some(80),
        })
        .await
        .expect("budget");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    sql_query("DELETE FROM budget_period_results WHERE budget_id = 'missing-result'")
        .execute(&mut conn)
        .expect("delete result");

    let history = budgets
        .get_budget_history("missing-result", 1, 50)
        .await
        .expect("recovered history");

    assert_eq!(history.data.len(), 1);
    assert_eq!(history.data[0].base_allowance, 10_000);
}
