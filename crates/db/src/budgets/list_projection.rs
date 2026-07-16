use super::models::{BudgetConfigurationRow, BudgetPeriodResultRow, BudgetRow, build_budget};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{budget_configurations, budget_period_results, budgets};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use std::collections::HashMap;
use zai_core::Error;
use zai_core::features::budgets::models::{
    Budget, BudgetCadence, BudgetListFilter, current_period,
};

pub(super) enum ProjectionState {
    Current(Budget),
    NeedsMaterialization,
}

pub(super) fn project_budget_list(
    conn: &mut SqliteConnection,
    filter: BudgetListFilter,
    now: NaiveDateTime,
) -> crate::errors::Result<Vec<(String, ProjectionState)>> {
    let query = budgets::table
        .filter(budgets::deleted_at.is_null())
        .into_boxed();
    let query = match filter {
        BudgetListFilter::Active => query.filter(budgets::paused.eq(false)),
        BudgetListFilter::Paused => query.filter(budgets::paused.eq(true)),
        BudgetListFilter::All => query,
    };
    let budget_rows = query
        .order((budgets::name.asc(), budgets::id.asc()))
        .load::<BudgetRow>(conn)
        .into_storage()?;
    if budget_rows.is_empty() {
        return Ok(Vec::new());
    }

    let ids = budget_rows
        .iter()
        .map(|budget| budget.id.clone())
        .collect::<Vec<_>>();
    let configurations = budget_configurations::table
        .filter(budget_configurations::budget_id.eq_any(&ids))
        .load::<BudgetConfigurationRow>(conn)
        .into_storage()?;
    let results = budget_period_results::table
        .filter(budget_period_results::budget_id.eq_any(&ids))
        .load::<BudgetPeriodResultRow>(conn)
        .into_storage()?;

    let mut configurations_by_budget = HashMap::<String, Vec<BudgetConfigurationRow>>::new();
    for configuration in configurations {
        configurations_by_budget
            .entry(configuration.budget_id.clone())
            .or_default()
            .push(configuration);
    }
    let mut results_by_budget = HashMap::<String, Vec<BudgetPeriodResultRow>>::new();
    for result in results {
        results_by_budget
            .entry(result.budget_id.clone())
            .or_default()
            .push(result);
    }

    budget_rows
        .into_iter()
        .map(|budget| {
            let id = budget.id.clone();
            let configurations = configurations_by_budget.remove(&id).unwrap_or_default();
            let results = results_by_budget.remove(&id).unwrap_or_default();
            let configuration = configurations
                .iter()
                .max_by_key(|row| row.period_start)
                .cloned();
            let result = configuration.as_ref().and_then(|configuration| {
                results
                    .iter()
                    .find(|row| row.period_start == configuration.period_start)
                    .cloned()
            });
            let state = decide_projection_state(
                budget,
                configuration,
                configurations.len() as i64,
                results.len() as i64,
                result,
                now,
            )?;
            Ok((id, state))
        })
        .collect()
}

pub(super) fn projected_budget_from_connection(
    conn: &mut SqliteConnection,
    id: &str,
    now: NaiveDateTime,
) -> crate::errors::Result<ProjectionState> {
    use diesel::OptionalExtension;

    let budget = budgets::table
        .filter(budgets::id.eq(id))
        .filter(budgets::deleted_at.is_null())
        .first::<BudgetRow>(conn)
        .into_storage()?;
    let configuration = budget_configurations::table
        .filter(budget_configurations::budget_id.eq(id))
        .order(budget_configurations::period_start.desc())
        .first::<BudgetConfigurationRow>(conn)
        .optional()
        .into_storage()?;
    let Some(configuration) = configuration else {
        return Ok(ProjectionState::NeedsMaterialization);
    };
    let configuration_count = budget_configurations::table
        .filter(budget_configurations::budget_id.eq(id))
        .count()
        .get_result::<i64>(conn)
        .into_storage()?;
    let result_count = budget_period_results::table
        .filter(budget_period_results::budget_id.eq(id))
        .count()
        .get_result::<i64>(conn)
        .into_storage()?;
    let result = budget_period_results::table
        .filter(budget_period_results::budget_id.eq(id))
        .filter(budget_period_results::period_start.eq(configuration.period_start))
        .first::<BudgetPeriodResultRow>(conn)
        .optional()
        .into_storage()?;
    decide_projection_state(
        budget,
        Some(configuration),
        configuration_count,
        result_count,
        result,
        now,
    )
}

fn decide_projection_state(
    budget: BudgetRow,
    configuration: Option<BudgetConfigurationRow>,
    configuration_count: i64,
    result_count: i64,
    result: Option<BudgetPeriodResultRow>,
    now: NaiveDateTime,
) -> crate::errors::Result<ProjectionState> {
    let cadence = budget.cadence.parse::<BudgetCadence>().map_err(|_| {
        StorageError::CoreError(Error::Repository("Invalid budget cadence".to_string()))
    })?;
    let (current_start, _) = current_period(now, cadence).map_err(StorageError::CoreError)?;
    let Some(configuration) = configuration else {
        return Ok(ProjectionState::NeedsMaterialization);
    };
    if configuration_count != result_count {
        return Ok(ProjectionState::NeedsMaterialization);
    }
    if configuration.period_start > current_start {
        return Err(StorageError::CoreError(Error::ClockRegression(
            "Budget period is ahead of the local calendar clock".to_string(),
        )));
    }
    let Some(result) = result else {
        return Ok(ProjectionState::NeedsMaterialization);
    };
    if configuration.period_start != current_start {
        return Ok(ProjectionState::NeedsMaterialization);
    }
    build_budget(budget, configuration, result)
        .map(ProjectionState::Current)
        .map_err(StorageError::CoreError)
}
