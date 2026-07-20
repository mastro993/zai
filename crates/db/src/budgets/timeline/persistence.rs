use super::calculate::{
    budget_zone, calculate_configuration, count_missing_periods, invalid_budget,
    load_category_hierarchy, next_period, parse_cadence, status_string, validate_period_boundaries,
};
use crate::budgets::models::{
    BudgetConfigurationRow, BudgetPeriodResultRow, BudgetRow, build_budget, midnight,
};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{budget_configurations, budget_period_results, budgets};
use chrono::{NaiveDate, NaiveDateTime};
use diesel::OptionalExtension;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::Result;
use zai_core::features::budgets::models::{
    Budget, BudgetCadence, BudgetPeriod, BudgetStatus, current_period,
};

pub(super) struct AdvanceInput {
    pub id: String,
    pub now: NaiveDateTime,
    pub budget: BudgetRow,
    pub cadence: BudgetCadence,
    pub current_start: NaiveDate,
    pub existing_configurations: Vec<BudgetConfigurationRow>,
    pub repair_all: bool,
}

pub(super) fn all_configurations(
    conn: &mut SqliteConnection,
    id: &str,
) -> crate::errors::Result<Vec<BudgetConfigurationRow>> {
    budget_configurations::table
        .filter(budget_configurations::budget_id.eq(id))
        .order(budget_configurations::period_start.asc())
        .load::<BudgetConfigurationRow>(conn)
        .into_storage()
}

pub(super) fn load_previous_period(
    conn: &mut SqliteConnection,
    id: &str,
    period_start: NaiveDate,
) -> crate::errors::Result<Option<BudgetPeriod>> {
    let Some(result) = budget_period_results::table
        .filter(budget_period_results::budget_id.eq(id))
        .filter(budget_period_results::period_start.lt(period_start))
        .order(budget_period_results::period_start.desc())
        .first::<BudgetPeriodResultRow>(conn)
        .optional()
        .into_storage()?
    else {
        return Ok(None);
    };
    let configuration = budget_configurations::table
        .filter(budget_configurations::budget_id.eq(id))
        .filter(budget_configurations::period_start.eq(result.period_start))
        .first::<BudgetConfigurationRow>(conn)
        .into_storage()?;
    period_from_rows(configuration, result)
        .map(Some)
        .map_err(StorageError::CoreError)
}

pub(crate) fn period_from_rows(
    configuration: BudgetConfigurationRow,
    result: BudgetPeriodResultRow,
) -> Result<BudgetPeriod> {
    if configuration.period_start >= configuration.period_end
        || result.period_start >= result.period_end
        || configuration.period_start != result.period_start
        || configuration.period_end != result.period_end
    {
        return Err(Error::Repository(
            "Invalid budget period boundaries".to_string(),
        ));
    }
    let status = match result.status.as_str() {
        "onTrack" => BudgetStatus::OnTrack,
        "warning" => BudgetStatus::Warning,
        "overspent" => BudgetStatus::Overspent,
        _ => return Err(Error::Repository("Invalid budget status".to_string())),
    };
    Ok(BudgetPeriod {
        start: midnight(result.period_start),
        end: midnight(result.period_end),
        base_allowance: configuration.base_allowance,
        effective_allowance: result.effective_allowance,
        net_budget_spending: result.net_budget_spending,
        remaining_allowance: result.remaining_allowance,
        status,
    })
}

pub(super) fn result_row(id: &str, period: &BudgetPeriod) -> BudgetPeriodResultRow {
    BudgetPeriodResultRow {
        budget_id: id.to_string(),
        period_start: period.start.date(),
        period_end: period.end.date(),
        net_budget_spending: period.net_budget_spending,
        effective_allowance: period.effective_allowance,
        remaining_allowance: period.remaining_allowance,
        status: status_string(period.status),
    }
}

pub(super) fn upsert_period_result(
    conn: &mut SqliteConnection,
    result: &BudgetPeriodResultRow,
) -> crate::errors::Result<()> {
    let changed = diesel::update(
        budget_period_results::table
            .filter(budget_period_results::budget_id.eq(&result.budget_id))
            .filter(budget_period_results::period_start.eq(result.period_start)),
    )
    .set((
        budget_period_results::period_end.eq(result.period_end),
        budget_period_results::net_budget_spending.eq(result.net_budget_spending),
        budget_period_results::effective_allowance.eq(result.effective_allowance),
        budget_period_results::remaining_allowance.eq(result.remaining_allowance),
        budget_period_results::status.eq(&result.status),
    ))
    .execute(conn)
    .into_storage()?;

    if changed == 0 {
        diesel::insert_into(budget_period_results::table)
            .values(result)
            .execute(conn)
            .into_storage()?;
    }
    Ok(())
}

pub(super) fn advance_timeline(
    conn: &mut SqliteConnection,
    input: AdvanceInput,
) -> crate::errors::Result<Budget> {
    let AdvanceInput {
        id,
        now,
        budget,
        cadence,
        current_start,
        existing_configurations,
        repair_all,
    } = input;
    let zone = budget_zone(&budget)?;
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
            period_end: period_end.date(),
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

        let period = calculate_configuration(
            conn,
            &configuration,
            &categories,
            previous_period.as_ref(),
            &zone,
        )?;
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

pub(super) fn rebuild_derived(conn: &mut SqliteConnection, id: &str) -> crate::errors::Result<()> {
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
    let zone = budget_zone(&budget)?;
    let configurations = all_configurations(conn, id)?;
    if configurations.is_empty() {
        return Ok(());
    }

    diesel::delete(budget_period_results::table.filter(budget_period_results::budget_id.eq(id)))
        .execute(conn)
        .into_storage()?;

    let categories = load_category_hierarchy(conn)?;
    let mut previous_period = None;
    for configuration in configurations {
        validate_period_boundaries(&configuration, cadence)?;
        let period = calculate_configuration(
            conn,
            &configuration,
            &categories,
            previous_period.as_ref(),
            &zone,
        )?;
        let result = result_row(id, &period);
        diesel::insert_into(budget_period_results::table)
            .values(&result)
            .execute(conn)
            .into_storage()?;
        previous_period = Some(period);
    }
    Ok(())
}

pub(super) fn refresh_current_configuration(
    conn: &mut SqliteConnection,
    id: &str,
    now: NaiveDateTime,
) -> crate::errors::Result<Budget> {
    let budget_row = budgets::table
        .filter(budgets::id.eq(id))
        .filter(budgets::deleted_at.is_null())
        .first::<BudgetRow>(conn)
        .into_storage()?;
    let cadence = parse_cadence(&budget_row)?;
    let zone = budget_zone(&budget_row)?;
    let (current_start, _) = current_period(now, cadence).map_err(StorageError::CoreError)?;
    let configuration = budget_configurations::table
        .filter(budget_configurations::budget_id.eq(id))
        .filter(budget_configurations::period_start.eq(current_start.date()))
        .first::<BudgetConfigurationRow>(conn)
        .into_storage()?;
    validate_period_boundaries(&configuration, cadence)?;
    let categories = load_category_hierarchy(conn)?;
    let previous_period = load_previous_period(conn, id, configuration.period_start)?;
    let period = calculate_configuration(
        conn,
        &configuration,
        &categories,
        previous_period.as_ref(),
        &zone,
    )?;
    let result = result_row(id, &period);
    upsert_period_result(conn, &result)?;
    build_budget(budget_row, configuration, result).map_err(StorageError::CoreError)
}
