use crate::budgets::models::{
    BudgetConfigurationRow, BudgetPeriodResultRow, BudgetRow, build_budget,
};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{budget_configurations, budget_period_results, budgets};
use chrono::NaiveDateTime;
use diesel::OptionalExtension;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use std::collections::HashMap;
use zai_core::Error;
use zai_core::features::budgets::models::{
    Budget, BudgetCadence, BudgetListFilter, current_period,
};

use super::{TimelineInspect, TimelineInspectEntry, TimelineSelection};

pub(super) fn inspect(
    conn: &mut SqliteConnection,
    selection: TimelineSelection,
    now: NaiveDateTime,
) -> crate::errors::Result<TimelineInspect> {
    let budget_rows = load_budget_rows(conn, &selection)?;
    if budget_rows.is_empty() {
        return Ok(TimelineInspect {
            entries: Vec::new(),
        });
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

    let mut entries = Vec::with_capacity(budget_rows.len());
    for budget in budget_rows {
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
        match decide_state(
            budget,
            configuration,
            configurations.len() as i64,
            results.len() as i64,
            result,
            now,
        )? {
            InspectState::Current(budget) => {
                entries.push(TimelineInspectEntry::Current(budget));
            }
            InspectState::Stale => {
                entries.push(TimelineInspectEntry::Stale { id });
            }
        }
    }

    Ok(TimelineInspect { entries })
}

pub(super) fn inspect_budget(
    conn: &mut SqliteConnection,
    id: &str,
    now: NaiveDateTime,
) -> crate::errors::Result<InspectState> {
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
        return Ok(InspectState::Stale);
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
    decide_state(
        budget,
        Some(configuration),
        configuration_count,
        result_count,
        result,
        now,
    )
}

pub(crate) enum InspectState {
    Current(Budget),
    Stale,
}

fn load_budget_rows(
    conn: &mut SqliteConnection,
    selection: &TimelineSelection,
) -> crate::errors::Result<Vec<BudgetRow>> {
    match selection {
        TimelineSelection::Filter(filter) => {
            let query = budgets::table
                .filter(budgets::deleted_at.is_null())
                .into_boxed();
            let query = match filter {
                BudgetListFilter::Active => query.filter(budgets::paused.eq(false)),
                BudgetListFilter::Paused => query.filter(budgets::paused.eq(true)),
                BudgetListFilter::All => query,
            };
            query
                .order((budgets::name.asc(), budgets::id.asc()))
                .load::<BudgetRow>(conn)
                .into_storage()
        }
        TimelineSelection::Ids(ids) => {
            if ids.is_empty() {
                return Ok(Vec::new());
            }
            budgets::table
                .filter(budgets::id.eq_any(ids))
                .filter(budgets::deleted_at.is_null())
                .order((budgets::name.asc(), budgets::id.asc()))
                .load::<BudgetRow>(conn)
                .into_storage()
        }
    }
}

fn decide_state(
    budget: BudgetRow,
    configuration: Option<BudgetConfigurationRow>,
    configuration_count: i64,
    result_count: i64,
    result: Option<BudgetPeriodResultRow>,
    now: NaiveDateTime,
) -> crate::errors::Result<InspectState> {
    let cadence = budget.cadence.parse::<BudgetCadence>().map_err(|_| {
        StorageError::CoreError(Error::Repository("Invalid budget cadence".to_string()))
    })?;
    let (current_start, _) = current_period(now, cadence).map_err(StorageError::CoreError)?;
    let Some(configuration) = configuration else {
        return Ok(InspectState::Stale);
    };
    if configuration_count != result_count {
        return Ok(InspectState::Stale);
    }
    if configuration.period_start > current_start {
        return Err(StorageError::CoreError(Error::ClockRegression(
            "Budget period is ahead of the local calendar clock".to_string(),
        )));
    }
    let Some(result) = result else {
        return Ok(InspectState::Stale);
    };
    if configuration.period_start != current_start {
        return Ok(InspectState::Stale);
    }
    build_budget(budget, configuration, result)
        .map(InspectState::Current)
        .map_err(StorageError::CoreError)
}
