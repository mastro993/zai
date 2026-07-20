use super::calculate::{
    budget_zone, calculate_configuration, count_missing_periods, invalid_budget,
    load_category_hierarchy, next_period, parse_cadence, validate_period_boundaries,
};
use super::impact::frontiers_for_transactions;
use super::inspect::{InspectState, inspect_budget};
use super::persistence::{
    AdvanceInput, advance_timeline, all_configurations, load_previous_period, rebuild_derived,
    refresh_current_configuration, result_row, upsert_period_result,
};
use crate::budgets::models::{BudgetConfigurationRow, BudgetRow};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{budget_configurations, budget_period_results, budgets};
use crate::transactions::models::TransactionRow;
use chrono::{NaiveDate, NaiveDateTime};
use diesel::OptionalExtension;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::budgets::models::{Budget, BudgetPeriod, current_period};

use super::{SourceChange, TimelineChange};

fn period_changed(before: &BudgetPeriod, after: &BudgetPeriod) -> bool {
    before.start != after.start
        || before.end != after.end
        || before.base_allowance != after.base_allowance
        || before.net_budget_spending != after.net_budget_spending
        || before.effective_allowance != after.effective_allowance
        || before.remaining_allowance != after.remaining_allowance
        || before.status != after.status
}

pub(super) fn ensure_ids(
    conn: &mut SqliteConnection,
    ids: &[String],
    now: NaiveDateTime,
) -> crate::errors::Result<(Vec<Budget>, Vec<TimelineChange>)> {
    let mut budgets = Vec::with_capacity(ids.len());
    let mut changes = Vec::new();
    for id in ids {
        let (budget, change) = ensure_one(conn, id, now)?;
        budgets.push(budget);
        if let Some(change) = change {
            changes.push(change);
        }
    }
    Ok((budgets, changes))
}

pub(super) fn reconcile_change(
    conn: &mut SqliteConnection,
    change: SourceChange,
    now: NaiveDateTime,
) -> crate::errors::Result<Vec<TimelineChange>> {
    match change {
        SourceChange::BudgetCreated {
            budget_id,
            category_ids,
        } => {
            seed_initial_configuration(conn, &budget_id, &category_ids, now)?;
            let (_, timeline_change) = ensure_one(conn, &budget_id, now)?;
            Ok(timeline_change.into_iter().collect())
        }
        SourceChange::BudgetConfigured { budget_id } => {
            let previous = current_period_snapshot(conn, &budget_id, now)?;
            let budget = refresh_current_configuration(conn, &budget_id, now)?;
            Ok(vec![TimelineChange {
                budget_id,
                previous_current: previous,
                resulting_current: budget.current_period,
            }])
        }
        SourceChange::Transactions { old, new } => reconcile_transactions(conn, now, &old, &new),
        SourceChange::CategoriesAffected { budget_ids } => {
            let mut changes = Vec::new();
            for budget_id in budget_ids {
                let active = budgets::table
                    .filter(budgets::id.eq(&budget_id))
                    .filter(budgets::deleted_at.is_null())
                    .select(budgets::id)
                    .first::<String>(conn)
                    .optional()
                    .into_storage()?;
                if active.is_none() {
                    continue;
                }
                let previous = current_period_snapshot(conn, &budget_id, now)?;
                rebuild_derived(conn, &budget_id)?;
                push_reconciled_change(conn, &mut changes, &budget_id, now, previous)?;
            }
            Ok(changes)
        }
    }
}

fn reconcile_transactions(
    conn: &mut SqliteConnection,
    now: NaiveDateTime,
    old_transactions: &[TransactionRow],
    new_transactions: &[TransactionRow],
) -> crate::errors::Result<Vec<TimelineChange>> {
    let frontiers = frontiers_for_transactions(conn, now, old_transactions, new_transactions)?;
    let mut changes = Vec::new();
    for frontier in frontiers {
        let previous = current_period_snapshot(conn, &frontier.budget_id, now)?;
        if frontier.needs_append {
            push_reconciled_change(conn, &mut changes, &frontier.budget_id, now, previous)?;
            continue;
        }
        if let Some(earliest) = frontier.earliest_period_start {
            repair_from_frontier(conn, &frontier.budget_id, earliest, now)?;
            push_reconciled_change(conn, &mut changes, &frontier.budget_id, now, previous)?;
        }
    }
    Ok(changes)
}

fn push_reconciled_change(
    conn: &mut SqliteConnection,
    changes: &mut Vec<TimelineChange>,
    budget_id: &str,
    now: NaiveDateTime,
    previous: Option<BudgetPeriod>,
) -> crate::errors::Result<()> {
    let (_, change) = ensure_one(conn, budget_id, now)?;
    if let Some(mut change) = change {
        if change.previous_current.is_none() {
            change.previous_current = previous;
        }
        changes.push(change);
        return Ok(());
    }
    if let Some(previous) = previous
        && let InspectState::Current(budget) = inspect_budget(conn, budget_id, now)?
        && (previous.start != budget.current_period.start
            || period_changed(&previous, &budget.current_period))
    {
        changes.push(TimelineChange {
            budget_id: budget_id.to_string(),
            previous_current: Some(previous),
            resulting_current: budget.current_period,
        });
    }
    Ok(())
}

fn ensure_one(
    conn: &mut SqliteConnection,
    id: &str,
    now: NaiveDateTime,
) -> crate::errors::Result<(Budget, Option<TimelineChange>)> {
    let previous = current_period_snapshot(conn, id, now)?;
    let budget_row = budgets::table
        .filter(budgets::id.eq(id))
        .filter(budgets::deleted_at.is_null())
        .first::<BudgetRow>(conn)
        .into_storage()?;
    let cadence = parse_cadence(&budget_row)?;
    let (current_start, _) = current_period(now, cadence).map_err(StorageError::CoreError)?;
    let current_start = current_start.date();
    let existing_configurations = all_configurations(conn, id)?;
    let result_count = budget_period_results::table
        .filter(budget_period_results::budget_id.eq(id))
        .count()
        .get_result::<i64>(conn)
        .into_storage()?;
    let configuration_count = existing_configurations.len();
    let repair_all = configuration_count > 0 && result_count != configuration_count as i64;
    let budget = advance_timeline(
        conn,
        AdvanceInput {
            id: id.to_string(),
            now,
            budget: budget_row,
            cadence,
            current_start,
            existing_configurations,
            repair_all,
        },
    )?;
    // Derived-result recovery stays silent. Initial period (one config, no results) still
    // reports a TimelineChange; alert policy suppresses previous_current == None.
    let initial_period = repair_all && result_count == 0 && configuration_count == 1;
    let change = if repair_all && !initial_period {
        None
    } else {
        match (&previous, budget.current_period.clone()) {
            (None, resulting) => Some(TimelineChange {
                budget_id: id.to_string(),
                previous_current: None,
                resulting_current: resulting,
            }),
            (Some(before), resulting)
                if before.start != resulting.start || period_changed(before, &resulting) =>
            {
                Some(TimelineChange {
                    budget_id: id.to_string(),
                    previous_current: Some(before.clone()),
                    resulting_current: resulting,
                })
            }
            _ => None,
        }
    };
    Ok((budget, change))
}

fn seed_initial_configuration(
    conn: &mut SqliteConnection,
    budget_id: &str,
    category_ids: &[String],
    now: NaiveDateTime,
) -> crate::errors::Result<()> {
    let existing = all_configurations(conn, budget_id)?;
    if !existing.is_empty() {
        return Ok(());
    }
    let budget_row = budgets::table
        .filter(budgets::id.eq(budget_id))
        .filter(budgets::deleted_at.is_null())
        .first::<BudgetRow>(conn)
        .into_storage()?;
    let cadence = parse_cadence(&budget_row)?;
    let (period_start, period_end) =
        current_period(now, cadence).map_err(StorageError::CoreError)?;
    let configuration = BudgetConfigurationRow {
        budget_id: budget_id.to_string(),
        period_start: period_start.date(),
        period_end: period_end.date(),
        category_ids: serde_json::to_string(category_ids).map_err(|error| {
            StorageError::CoreError(Error::InvalidData(format!(
                "Invalid budget category scope: {error}"
            )))
        })?,
        base_allowance: budget_row.base_allowance,
        measurement_mode: budget_row.measurement_mode,
        rollover_mode: budget_row.rollover_mode,
        warning_percentage: budget_row.warning_percentage,
    };
    diesel::insert_into(budget_configurations::table)
        .values(&configuration)
        .execute(conn)
        .into_storage()?;
    Ok(())
}

fn current_period_snapshot(
    conn: &mut SqliteConnection,
    id: &str,
    now: NaiveDateTime,
) -> crate::errors::Result<Option<BudgetPeriod>> {
    match inspect_budget(conn, id, now)? {
        InspectState::Current(budget) => Ok(Some(budget.current_period)),
        InspectState::Stale => load_latest_persisted_period(conn, id),
    }
}

fn load_latest_persisted_period(
    conn: &mut SqliteConnection,
    id: &str,
) -> crate::errors::Result<Option<BudgetPeriod>> {
    let Some(configuration) = budget_configurations::table
        .filter(budget_configurations::budget_id.eq(id))
        .order(budget_configurations::period_start.desc())
        .first::<BudgetConfigurationRow>(conn)
        .optional()
        .into_storage()?
    else {
        return Ok(None);
    };
    let Some(result) = budget_period_results::table
        .filter(budget_period_results::budget_id.eq(id))
        .filter(budget_period_results::period_start.eq(configuration.period_start))
        .first::<crate::budgets::models::BudgetPeriodResultRow>(conn)
        .optional()
        .into_storage()?
    else {
        return Ok(None);
    };
    super::persistence::period_from_rows(configuration, result)
        .map(Some)
        .map_err(StorageError::CoreError)
}

fn repair_from_frontier(
    conn: &mut SqliteConnection,
    id: &str,
    earliest_period_start: NaiveDate,
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
    let zone = budget_zone(&budget)?;
    let (current_start, _) = current_period(now, cadence).map_err(StorageError::CoreError)?;
    let current_start = current_start.date();
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
        ensure_one(conn, id, now)?;
        return Ok(());
    }

    let mut configuration = configurations
        .iter()
        .find(|configuration| configuration.period_start == earliest_period_start)
        .cloned()
        .ok_or_else(|| invalid_budget("Invalid budget repair frontier"))?;
    let mut previous_period = load_previous_period(conn, id, configuration.period_start)?;
    if configuration.period_start != first_configuration.period_start && previous_period.is_none() {
        ensure_one(conn, id, now)?;
        return Ok(());
    }
    let categories = load_category_hierarchy(conn)?;

    loop {
        validate_period_boundaries(&configuration, cadence)?;
        let period = calculate_configuration(
            conn,
            &configuration,
            &categories,
            previous_period.as_ref(),
            &zone,
        )?;
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

pub(super) fn load_current_or_ensure(
    conn: &mut SqliteConnection,
    id: &str,
    now: NaiveDateTime,
) -> crate::errors::Result<Budget> {
    match inspect_budget(conn, id, now)? {
        InspectState::Current(budget) => Ok(budget),
        InspectState::Stale => Ok(ensure_one(conn, id, now)?.0),
    }
}
