use super::models::{BudgetConfigurationRow, BudgetPeriodResultRow};
use super::projection_persistence::period_from_rows;
use crate::errors::IntoCore;
use crate::pagination::total_pages;
use crate::schema::{budget_configurations, budget_period_results, budgets};
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::budgets::models::BudgetPeriodHistory;
use zai_core::features::budgets::models::validate_history_paging;

pub(super) fn load_history(
    conn: &mut SqliteConnection,
    id: &str,
    page: i64,
    per_page: i64,
) -> Result<BudgetPeriodHistory> {
    validate_history_paging(page, per_page)?;
    budgets::table
        .filter(budgets::id.eq(id))
        .filter(budgets::deleted_at.is_null())
        .select(budgets::id)
        .first::<String>(conn)
        .into_core()?;

    let total = budget_period_results::table
        .filter(budget_period_results::budget_id.eq(id))
        .count()
        .get_result::<i64>(conn)
        .into_core()?;
    let offset = (page - 1) * per_page;
    let rows = budget_period_results::table
        .inner_join(
            budget_configurations::table.on(budget_period_results::budget_id
                .eq(budget_configurations::budget_id)
                .and(budget_period_results::period_start.eq(budget_configurations::period_start))),
        )
        .filter(budget_period_results::budget_id.eq(id))
        .order(budget_period_results::period_start.desc())
        .limit(per_page)
        .offset(offset)
        .select((
            budget_period_results::all_columns,
            budget_configurations::all_columns,
        ))
        .load::<(BudgetPeriodResultRow, BudgetConfigurationRow)>(conn)
        .into_core()?;
    let data = rows
        .into_iter()
        .map(|(result, configuration)| period_from_rows(configuration, result))
        .collect::<Result<Vec<_>>>()?;

    Ok(BudgetPeriodHistory {
        data,
        page,
        per_page,
        total_pages: total_pages(total, per_page),
    })
}
