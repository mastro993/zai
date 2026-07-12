use super::calculation::{
    calculate_configuration, load_category_hierarchy, map_budget_insert_error,
};
use super::models::{BudgetConfigurationRow, BudgetRow};
use super::projection::{load_previous_period, result_row, upsert_period_result};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{budget_configurations, budgets};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::budgets::models::{
    Budget, BudgetPeriod, BudgetUpdate, CategoryHierarchy, canonicalize_category_ids,
};

pub(super) fn update_budget(
    conn: &mut SqliteConnection,
    id: &str,
    update: BudgetUpdate,
    now: NaiveDateTime,
) -> crate::errors::Result<Budget> {
    let stored = load_active_budget(conn, id)?;
    ensure_expected_revision(&stored, update.expected_revision)?;
    let cadence = super::repository::parse_cadence(&stored).map_err(StorageError::CoreError)?;
    if update.cadence != cadence {
        return Err(StorageError::CoreError(Error::InvalidData(
            "Budget cadence cannot be changed after creation".to_string(),
        )));
    }

    let mut budget = match super::repository::projected_budget_from_connection(conn, id, now)? {
        super::repository::ProjectionState::Current(budget) => budget,
        super::repository::ProjectionState::NeedsMaterialization => {
            super::projection::materialize_budget(conn, id, now)?
        }
    };
    let categories = load_category_hierarchy(conn)?;
    let category_ids = canonicalize_category_ids(&update.category_ids, &categories);
    let configuration_changed = configuration_changed(&budget, &update, &category_ids);
    let revision = next_revision(stored.revision)?;
    update_budget_row(conn, id, &update, revision)?;

    if configuration_changed {
        let period =
            replace_current_configuration(conn, id, &budget, &update, &category_ids, &categories)?;
        budget.category_ids = category_ids;
        budget.measurement_mode = update.measurement_mode;
        budget.base_allowance = update.base_allowance;
        budget.rollover_mode = update.rollover_mode;
        budget.warning_percentage = update.warning_percentage;
        budget.current_period = period;
    }

    budget.name = update.name;
    budget.revision = revision;
    Ok(budget)
}

fn load_active_budget(conn: &mut SqliteConnection, id: &str) -> crate::errors::Result<BudgetRow> {
    budgets::table
        .filter(budgets::id.eq(id))
        .filter(budgets::deleted_at.is_null())
        .first::<BudgetRow>(conn)
        .into_storage()
}

fn ensure_expected_revision(
    budget: &BudgetRow,
    expected_revision: i64,
) -> crate::errors::Result<()> {
    if budget.revision != expected_revision {
        return Err(StorageError::CoreError(Error::RevisionConflict {
            current_revision: budget.revision,
        }));
    }
    Ok(())
}

fn next_revision(revision: i64) -> crate::errors::Result<i64> {
    revision.checked_add(1).ok_or_else(|| {
        StorageError::CoreError(Error::InvalidData("Budget revision overflow".to_string()))
    })
}

fn configuration_changed(budget: &Budget, update: &BudgetUpdate, category_ids: &[String]) -> bool {
    budget.category_ids.as_slice() != category_ids
        || budget.base_allowance != update.base_allowance
        || budget.measurement_mode != update.measurement_mode
        || budget.rollover_mode != update.rollover_mode
        || budget.warning_percentage != update.warning_percentage
}

fn update_budget_row(
    conn: &mut SqliteConnection,
    id: &str,
    update: &BudgetUpdate,
    revision: i64,
) -> crate::errors::Result<()> {
    let timestamp = chrono::Utc::now().naive_utc();
    let measurement_mode = update.measurement_mode.to_string();
    let rollover_mode = update.rollover_mode.to_string();
    diesel::update(
        budgets::table
            .filter(budgets::id.eq(id))
            .filter(budgets::deleted_at.is_null()),
    )
    .set((
        budgets::name.eq(&update.name),
        budgets::measurement_mode.eq(&measurement_mode),
        budgets::base_allowance.eq(update.base_allowance),
        budgets::rollover_mode.eq(&rollover_mode),
        budgets::warning_percentage.eq(update.warning_percentage),
        budgets::updated_at.eq(timestamp),
        budgets::revision.eq(revision),
    ))
    .execute(conn)
    .map_err(map_budget_insert_error)?;
    Ok(())
}

fn replace_current_configuration(
    conn: &mut SqliteConnection,
    id: &str,
    budget: &Budget,
    update: &BudgetUpdate,
    category_ids: &[String],
    categories: &[CategoryHierarchy],
) -> crate::errors::Result<BudgetPeriod> {
    let configuration = BudgetConfigurationRow {
        budget_id: id.to_string(),
        period_start: budget.current_period.start,
        period_end: budget.current_period.end,
        category_ids: serde_json::to_string(category_ids).map_err(|error| {
            StorageError::CoreError(Error::InvalidData(format!(
                "Invalid budget category scope: {error}"
            )))
        })?,
        base_allowance: update.base_allowance,
        measurement_mode: update.measurement_mode.to_string(),
        rollover_mode: update.rollover_mode.to_string(),
        warning_percentage: update.warning_percentage,
    };
    diesel::update(
        budget_configurations::table
            .filter(budget_configurations::budget_id.eq(id))
            .filter(budget_configurations::period_start.eq(configuration.period_start)),
    )
    .set((
        budget_configurations::period_end.eq(configuration.period_end),
        budget_configurations::category_ids.eq(&configuration.category_ids),
        budget_configurations::base_allowance.eq(configuration.base_allowance),
        budget_configurations::measurement_mode.eq(&configuration.measurement_mode),
        budget_configurations::rollover_mode.eq(&configuration.rollover_mode),
        budget_configurations::warning_percentage.eq(configuration.warning_percentage),
    ))
    .execute(conn)
    .into_storage()?;

    let previous_period = load_previous_period(conn, id, configuration.period_start)?;
    let period =
        calculate_configuration(conn, &configuration, categories, previous_period.as_ref())?;
    let result = result_row(id, &period);
    upsert_period_result(conn, &result)?;
    Ok(period)
}
