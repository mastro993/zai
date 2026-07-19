use crate::budgets::models::{BudgetConfigurationRow, BudgetPeriodResultRow, BudgetRow};
use crate::connection::run_migrations;
use crate::schema::{budget_configurations, budget_period_results, budgets};
use crate::test_utils::TempDb;
use chrono::{NaiveDate, NaiveDateTime};
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetMeasurementMode, BudgetRolloverMode, calculate_period_with_rollover,
    current_period,
};

pub(super) fn date(year: i32, month: u32, day: u32) -> NaiveDateTime {
    NaiveDate::from_ymd_opt(year, month, day)
        .expect("date")
        .and_hms_opt(12, 0, 0)
        .expect("time")
}

pub(super) fn setup_conn(temp_db: &TempDb) -> SqliteConnection {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    SqliteConnection::establish(temp_db.path()).expect("connect")
}

pub(super) fn insert_budget_row(
    conn: &mut SqliteConnection,
    id: &str,
    cadence: BudgetCadence,
    rollover_mode: BudgetRolloverMode,
    paused: bool,
    now: NaiveDateTime,
) -> crate::errors::Result<()> {
    let timestamp = chrono::Utc::now().naive_utc();
    diesel::insert_into(budgets::table)
        .values(&BudgetRow {
            id: id.to_string(),
            name: format!("Budget {id}"),
            cadence: cadence.to_string(),
            measurement_mode: BudgetMeasurementMode::Spending.to_string(),
            base_allowance: 10_000,
            rollover_mode: rollover_mode.to_string(),
            warning_percentage: Some(80),
            created_at: timestamp,
            updated_at: timestamp,
            deleted_at: None,
            revision: 0,
            paused,
        })
        .execute(conn)?;
    let (period_start, period_end) =
        current_period(now, cadence).map_err(crate::errors::StorageError::CoreError)?;
    let spending = super::calculate::calculate_spending(
        conn,
        period_start,
        period_end,
        BudgetMeasurementMode::Spending,
        &[],
    )?;
    let period = calculate_period_with_rollover(
        period_start,
        period_end,
        10_000,
        spending,
        rollover_mode,
        None,
        Some(80),
    )
    .map_err(crate::errors::StorageError::CoreError)?;
    let configuration = BudgetConfigurationRow {
        budget_id: id.to_string(),
        period_start,
        period_end,
        category_ids: "[]".to_string(),
        base_allowance: 10_000,
        measurement_mode: BudgetMeasurementMode::Spending.to_string(),
        rollover_mode: rollover_mode.to_string(),
        warning_percentage: Some(80),
    };
    diesel::insert_into(budget_configurations::table)
        .values(&configuration)
        .execute(conn)?;
    diesel::insert_into(budget_period_results::table)
        .values(&BudgetPeriodResultRow {
            budget_id: id.to_string(),
            period_start,
            period_end,
            net_budget_spending: period.net_budget_spending,
            effective_allowance: period.effective_allowance,
            remaining_allowance: period.remaining_allowance,
            status: super::calculate::status_string(period.status),
        })
        .execute(conn)?;
    Ok(())
}
