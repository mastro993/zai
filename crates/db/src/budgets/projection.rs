use super::alerts::{BudgetAlertSnapshot, emit_budget_transition_alerts};
use super::calculation::{
    calculate_configuration, count_missing_periods, invalid_budget, load_category_hierarchy,
    next_period, parse_cadence, validate_period_boundaries,
};
use super::models::{BudgetConfigurationRow, BudgetRow, build_budget};
pub(super) use super::projection_persistence::{
    all_configurations, load_previous_period, result_row, upsert_period_result,
};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{budget_configurations, budget_period_results, budgets};
use chrono::NaiveDateTime;
use diesel::OptionalExtension;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use std::collections::HashMap;
use zai_core::Error;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::budgets::models::{Budget, BudgetCadence, current_period};

struct MaterializeBudgetInput {
    id: String,
    now: NaiveDateTime,
    budget: BudgetRow,
    cadence: BudgetCadence,
    current_start: NaiveDateTime,
    existing_configurations: Vec<BudgetConfigurationRow>,
    repair_all: bool,
}

pub(crate) fn materialize_budget(
    conn: &mut SqliteConnection,
    id: &str,
    now: NaiveDateTime,
) -> crate::errors::Result<Budget> {
    materialize_budget_with_options(conn, id, now, false)
}

pub(crate) fn materialize_budget_silent(
    conn: &mut SqliteConnection,
    id: &str,
    now: NaiveDateTime,
) -> crate::errors::Result<Budget> {
    materialize_budget_with_options(conn, id, now, true)
}

fn materialize_budget_with_options(
    conn: &mut SqliteConnection,
    id: &str,
    now: NaiveDateTime,
    suppress_alerts: bool,
) -> crate::errors::Result<Budget> {
    let budget_row = budgets::table
        .filter(budgets::id.eq(id))
        .filter(budgets::deleted_at.is_null())
        .first::<BudgetRow>(conn)
        .into_storage()?;
    let cadence = parse_cadence(&budget_row)?;
    let (current_start, _) = current_period(now, cadence).map_err(StorageError::CoreError)?;
    let existing_configurations = all_configurations(conn, id)?;
    let result_count = budget_period_results::table
        .filter(budget_period_results::budget_id.eq(id))
        .count()
        .get_result::<i64>(conn)
        .into_storage()?;
    let repair_all =
        !existing_configurations.is_empty() && result_count != existing_configurations.len() as i64;
    let missing_periods = existing_configurations
        .last()
        .map(|configuration| {
            count_missing_periods(configuration, current_start, cadence).unwrap_or(0)
        })
        .unwrap_or(0);
    let alert_mode = if suppress_alerts
        || budget_row.paused
        || repair_all
        || existing_configurations.is_empty()
        || missing_periods == 0
    {
        BudgetAlertMode::Silent
    } else {
        BudgetAlertMode::Transition
    };
    let before = if alert_mode == BudgetAlertMode::Transition {
        projected_before_snapshot(conn, id, &budget_row, &existing_configurations)
    } else {
        None
    };
    let budget = materialize_budget_inner(
        conn,
        MaterializeBudgetInput {
            id: id.to_string(),
            now,
            budget: budget_row,
            cadence,
            current_start,
            existing_configurations,
            repair_all,
        },
    )?;
    if alert_mode == BudgetAlertMode::Transition && !budget.paused {
        let after = BudgetAlertSnapshot {
            id: budget.id.clone(),
            name: budget.name.clone(),
            paused: budget.paused,
            period_start: budget.current_period.start,
            period: budget.current_period.clone(),
        };
        let before_map = before
            .map(|snapshot| [(snapshot.id.clone(), snapshot)])
            .into_iter()
            .flatten()
            .collect::<HashMap<_, _>>();
        let after_map = HashMap::from([(after.id.clone(), after)]);
        emit_budget_transition_alerts(conn, alert_mode, &before_map, &after_map)?;
    }
    Ok(budget)
}

fn projected_before_snapshot(
    conn: &mut SqliteConnection,
    id: &str,
    budget_row: &BudgetRow,
    configurations: &[BudgetConfigurationRow],
) -> Option<BudgetAlertSnapshot> {
    let configuration = configurations.last()?;
    let result = budget_period_results::table
        .filter(budget_period_results::budget_id.eq(id))
        .filter(budget_period_results::period_start.eq(configuration.period_start))
        .first::<super::models::BudgetPeriodResultRow>(conn)
        .optional()
        .ok()??;
    let budget = build_budget(budget_row.clone(), configuration.clone(), result).ok()?;
    Some(BudgetAlertSnapshot {
        id: budget.id,
        name: budget.name,
        paused: budget.paused,
        period_start: budget.current_period.start,
        period: budget.current_period,
    })
}

fn materialize_budget_inner(
    conn: &mut SqliteConnection,
    input: MaterializeBudgetInput,
) -> crate::errors::Result<Budget> {
    let MaterializeBudgetInput {
        id,
        now,
        budget,
        cadence,
        current_start,
        existing_configurations,
        repair_all,
    } = input;
    let mut configuration = if repair_all {
        existing_configurations
            .first()
            .cloned()
            .ok_or_else(|| invalid_budget("Invalid budget configuration projection"))?
    } else if let Some(configuration) = existing_configurations.last().cloned() {
        configuration
    } else {
        let (_, period_end) = current_period(now, cadence).map_err(StorageError::CoreError)?;
        let configuration = BudgetConfigurationRow {
            budget_id: id.clone(),
            period_start: current_start,
            period_end,
            category_ids: "[]".to_string(),
            base_allowance: budget.base_allowance,
            measurement_mode: budget.measurement_mode.clone(),
            rollover_mode: budget.rollover_mode.clone(),
            warning_percentage: budget.warning_percentage,
        };
        diesel::insert_into(budget_configurations::table)
            .values(&configuration)
            .execute(conn)
            .into_storage()?;
        configuration
    };

    if configuration.period_start > current_start {
        return Err(StorageError::CoreError(Error::ClockRegression(
            "Budget period is ahead of the local calendar clock".to_string(),
        )));
    }
    validate_period_boundaries(&configuration, cadence)?;
    let missing_periods = count_missing_periods(&configuration, current_start, cadence)?;
    let categories = load_category_hierarchy(conn)?;
    let mut previous_period = load_previous_period(conn, &id, configuration.period_start)?;
    let mut current_result = None;

    for index in 0..=missing_periods {
        if index > 0 {
            let (period_start, period_end) = next_period(&configuration, cadence)?;
            let existing = repair_all
                .then(|| {
                    existing_configurations
                        .iter()
                        .find(|row| row.period_start == period_start)
                        .cloned()
                })
                .flatten();
            configuration = existing.unwrap_or_else(|| BudgetConfigurationRow {
                budget_id: id.clone(),
                period_start,
                period_end,
                category_ids: configuration.category_ids.clone(),
                base_allowance: configuration.base_allowance,
                measurement_mode: configuration.measurement_mode.clone(),
                rollover_mode: configuration.rollover_mode.clone(),
                warning_percentage: configuration.warning_percentage,
            });
            if configuration.period_start == period_start
                && !existing_configurations
                    .iter()
                    .any(|row| row.period_start == period_start)
            {
                diesel::insert_into(budget_configurations::table)
                    .values(&configuration)
                    .execute(conn)
                    .into_storage()?;
            }
        }
        validate_period_boundaries(&configuration, cadence)?;

        let period =
            calculate_configuration(conn, &configuration, &categories, previous_period.as_ref())?;
        let result = result_row(&id, &period);
        upsert_period_result(conn, &result)?;
        previous_period = Some(period);

        if configuration.period_start == current_start {
            current_result = Some(result);
            break;
        }
    }

    let result = current_result.ok_or_else(|| {
        StorageError::CoreError(Error::Repository(
            "Budget current period could not be materialized".to_string(),
        ))
    })?;
    build_budget(budget, configuration, result).map_err(StorageError::CoreError)
}

pub(crate) fn refresh_active_budget_projections(
    conn: &mut SqliteConnection,
    now: NaiveDateTime,
) -> crate::errors::Result<()> {
    let ids = budgets::table
        .filter(budgets::deleted_at.is_null())
        .select(budgets::id)
        .load::<String>(conn)
        .into_storage()?;

    for id in ids {
        materialize_budget(conn, &id, now)?;
    }
    Ok(())
}

pub(crate) fn rebuild_budget_projections(
    conn: &mut SqliteConnection,
    budget_ids: &[String],
) -> crate::errors::Result<()> {
    if budget_ids.is_empty() {
        return Ok(());
    }

    let active_budget_ids = budgets::table
        .filter(budgets::id.eq_any(budget_ids))
        .filter(budgets::deleted_at.is_null())
        .select(budgets::id)
        .load::<String>(conn)
        .into_storage()?;
    if active_budget_ids.is_empty() {
        return Ok(());
    }
    let categories = load_category_hierarchy(conn)?;
    for budget_id in active_budget_ids {
        rebuild_budget_projection(conn, &budget_id, &categories)?;
    }
    Ok(())
}

fn rebuild_budget_projection(
    conn: &mut SqliteConnection,
    id: &str,
    categories: &[zai_core::features::budgets::models::CategoryHierarchy],
) -> crate::errors::Result<()> {
    let Some(budget) = budgets::table
        .filter(budgets::id.eq(id))
        .filter(budgets::deleted_at.is_null())
        .first::<BudgetRow>(conn)
        .optional()
        .into_storage()?
    else {
        return Ok(());
    };
    let cadence = parse_cadence(&budget)?;
    let configurations = all_configurations(conn, id)?;

    if configurations.is_empty() {
        return Ok(());
    }

    diesel::delete(budget_period_results::table.filter(budget_period_results::budget_id.eq(id)))
        .execute(conn)
        .into_storage()?;

    let mut previous_period = None;
    for configuration in configurations {
        validate_period_boundaries(&configuration, cadence)?;
        let period =
            calculate_configuration(conn, &configuration, categories, previous_period.as_ref())?;
        let result = result_row(id, &period);
        diesel::insert_into(budget_period_results::table)
            .values(&result)
            .execute(conn)
            .into_storage()?;
        previous_period = Some(period);
    }

    Ok(())
}

pub(crate) fn repair_budget_results(
    conn: &mut SqliteConnection,
    id: &str,
    earliest_period_start: NaiveDateTime,
    now: NaiveDateTime,
) -> crate::errors::Result<()> {
    let Some(budget) = budgets::table
        .filter(budgets::id.eq(id))
        .filter(budgets::deleted_at.is_null())
        .first::<BudgetRow>(conn)
        .optional()
        .into_storage()?
    else {
        return Ok(());
    };
    let cadence = parse_cadence(&budget)?;
    let (current_start, _) = current_period(now, cadence).map_err(StorageError::CoreError)?;
    let configurations = all_configurations(conn, id)?;
    let first_configuration = configurations
        .first()
        .cloned()
        .ok_or_else(|| invalid_budget("Invalid budget configuration projection"))?;
    let latest_period_start = configurations
        .last()
        .expect("budget configurations cannot be empty")
        .period_start;

    if first_configuration.period_start > current_start || latest_period_start > current_start {
        return Err(StorageError::CoreError(Error::ClockRegression(
            "Budget period is ahead of the local calendar clock".to_string(),
        )));
    }

    count_missing_periods(&first_configuration, current_start, cadence)?;

    let result_count = budget_period_results::table
        .filter(budget_period_results::budget_id.eq(id))
        .count()
        .get_result::<i64>(conn)
        .into_storage()?;
    if result_count != configurations.len() as i64 {
        materialize_budget(conn, id, now)?;
        return Ok(());
    }

    let mut configuration = configurations
        .iter()
        .find(|configuration| configuration.period_start == earliest_period_start)
        .cloned()
        .ok_or_else(|| invalid_budget("Invalid budget repair frontier"))?;
    let mut previous_period = load_previous_period(conn, id, configuration.period_start)?;
    if configuration.period_start != first_configuration.period_start && previous_period.is_none() {
        materialize_budget(conn, id, now)?;
        return Ok(());
    }
    let categories = load_category_hierarchy(conn)?;

    loop {
        validate_period_boundaries(&configuration, cadence)?;
        let period =
            calculate_configuration(conn, &configuration, &categories, previous_period.as_ref())?;
        let result = result_row(id, &period);
        upsert_period_result(conn, &result)?;
        previous_period = Some(period);

        if configuration.period_start == current_start {
            break;
        }

        let (period_start, period_end) = next_period(&configuration, cadence)?;
        configuration = if let Some(existing) = configurations
            .iter()
            .find(|candidate| candidate.period_start == period_start)
            .cloned()
        {
            existing
        } else {
            let next = BudgetConfigurationRow {
                budget_id: id.to_string(),
                period_start,
                period_end,
                category_ids: configuration.category_ids.clone(),
                base_allowance: configuration.base_allowance,
                measurement_mode: configuration.measurement_mode.clone(),
                rollover_mode: configuration.rollover_mode.clone(),
                warning_percentage: configuration.warning_percentage,
            };
            diesel::insert_into(budget_configurations::table)
                .values(&next)
                .execute(conn)
                .into_storage()?;
            next
        };
    }

    Ok(())
}
