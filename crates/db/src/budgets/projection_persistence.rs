use super::calculation::status_string;
use super::models::{BudgetConfigurationRow, BudgetPeriodResultRow};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{budget_configurations, budget_period_results};
use chrono::NaiveDateTime;
use diesel::OptionalExtension;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::features::budgets::models::{BudgetPeriod, BudgetStatus};
use zai_core::{Error, Result};

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
    period_start: NaiveDateTime,
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

pub(super) fn period_from_rows(
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
        start: result.period_start,
        end: result.period_end,
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
        period_start: period.start,
        period_end: period.end,
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
