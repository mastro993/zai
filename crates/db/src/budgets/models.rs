use crate::schema::{budget_configurations, budget_period_results, budgets};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use zai_core::features::budgets::models::{
    Budget, BudgetCadence, BudgetMeasurementMode, BudgetPeriod, BudgetRolloverMode, BudgetStatus,
};

#[derive(Queryable, Identifiable, Insertable, Selectable, Debug, Clone)]
#[diesel(table_name = budgets)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct BudgetRow {
    pub id: String,
    pub name: String,
    pub cadence: String,
    pub measurement_mode: String,
    pub base_allowance: i64,
    pub rollover_mode: String,
    pub warning_percentage: Option<i32>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub deleted_at: Option<NaiveDateTime>,
    pub revision: i64,
    pub paused: bool,
}

#[derive(Queryable, Insertable, Debug, Clone)]
#[diesel(table_name = budget_configurations)]
#[diesel(primary_key(budget_id, period_start))]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct BudgetConfigurationRow {
    pub budget_id: String,
    pub period_start: NaiveDateTime,
    pub period_end: NaiveDateTime,
    pub category_ids: String,
    pub base_allowance: i64,
    pub measurement_mode: String,
    pub rollover_mode: String,
    pub warning_percentage: Option<i32>,
    pub allowance_currency: String,
}

#[derive(Queryable, Insertable, Debug, Clone)]
#[diesel(table_name = budget_period_results)]
#[diesel(primary_key(budget_id, period_start))]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct BudgetPeriodResultRow {
    pub budget_id: String,
    pub period_start: NaiveDateTime,
    pub period_end: NaiveDateTime,
    pub net_budget_spending: i64,
    pub effective_allowance: Option<i64>,
    pub remaining_allowance: Option<i64>,
    pub status: Option<String>,
    pub generation_id: String,
    pub complete: bool,
}

pub fn build_budget(
    budget: BudgetRow,
    configuration: BudgetConfigurationRow,
    result: BudgetPeriodResultRow,
) -> zai_core::Result<Budget> {
    if configuration.period_start >= configuration.period_end
        || result.period_start >= result.period_end
        || configuration.period_start != result.period_start
        || configuration.period_end != result.period_end
    {
        return Err(zai_core::Error::Repository(
            "Invalid budget period boundaries".to_string(),
        ));
    }
    let cadence = budget
        .cadence
        .parse::<BudgetCadence>()
        .map_err(|_| zai_core::Error::Repository("Invalid budget cadence".to_string()))?;
    let measurement_mode = configuration
        .measurement_mode
        .parse::<BudgetMeasurementMode>()
        .map_err(|_| zai_core::Error::Repository("Invalid budget measurement mode".to_string()))?;
    let rollover_mode = configuration
        .rollover_mode
        .parse::<BudgetRolloverMode>()
        .map_err(|_| zai_core::Error::Repository("Invalid budget rollover mode".to_string()))?;
    let (status, effective_allowance, remaining_allowance) = if result.complete {
        let status = match result.status.as_deref() {
            Some("onTrack") => BudgetStatus::OnTrack,
            Some("warning") => BudgetStatus::Warning,
            Some("overspent") => BudgetStatus::Overspent,
            _ => {
                return Err(zai_core::Error::Repository(
                    "Invalid budget status".to_string(),
                ));
            }
        };
        let effective = result.effective_allowance.ok_or_else(|| {
            zai_core::Error::Repository("Complete period missing effective allowance".to_string())
        })?;
        let remaining = result.remaining_allowance.ok_or_else(|| {
            zai_core::Error::Repository("Complete period missing remaining allowance".to_string())
        })?;
        (status, effective, remaining)
    } else {
        (BudgetStatus::OnTrack, 0, 0)
    };
    let category_ids = serde_json::from_str(&configuration.category_ids)
        .map_err(|_| zai_core::Error::Repository("Invalid budget category scope".to_string()))?;

    Ok(Budget {
        id: budget.id,
        name: budget.name,
        revision: budget.revision,
        paused: budget.paused,
        category_ids,
        cadence,
        measurement_mode,
        base_allowance: configuration.base_allowance,
        rollover_mode,
        warning_percentage: configuration.warning_percentage,
        current_period: BudgetPeriod {
            start: result.period_start,
            end: result.period_end,
            base_allowance: configuration.base_allowance,
            effective_allowance,
            net_budget_spending: result.net_budget_spending,
            remaining_allowance,
            status,
            complete: result.complete,
        },
    })
}
