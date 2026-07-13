use super::calculation::{load_category_hierarchy, parse_cadence, parse_category_ids};
use super::models::{BudgetConfigurationRow, BudgetRow};
use super::projection::{materialize_budget, repair_budget_results};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{budget_configurations, budgets};
use crate::transactions::models::TransactionRow;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::features::budgets::models::{
    CategoryHierarchy, current_period, expand_category_scope,
};

pub(crate) fn repair_transaction_budget_projections(
    conn: &mut SqliteConnection,
    now: NaiveDateTime,
    old_transactions: &[TransactionRow],
    new_transactions: &[TransactionRow],
) -> crate::errors::Result<()> {
    if old_transactions.is_empty() && new_transactions.is_empty() {
        return Ok(());
    }

    let categories = load_category_hierarchy(conn)?;
    let budget_rows = budgets::table
        .filter(budgets::deleted_at.is_null())
        .load::<BudgetRow>(conn)
        .into_storage()?;

    for budget in budget_rows {
        let budget_id = budget.id.clone();
        let cadence = parse_cadence(&budget)?;
        let (current_start, current_end) =
            current_period(now, cadence).map_err(StorageError::CoreError)?;
        let configurations = budget_configurations::table
            .filter(budget_configurations::budget_id.eq(&budget_id))
            .order(budget_configurations::period_start.asc())
            .load::<BudgetConfigurationRow>(conn)
            .into_storage()?;

        let earliest_period = configurations.iter().try_fold(
            None,
            |earliest: Option<NaiveDateTime>, configuration| {
                let scope = budget_scope(configuration, &categories)?;
                let configuration_earliest = old_transactions
                    .iter()
                    .chain(new_transactions)
                    .filter(|transaction| transaction_matches_period(transaction, configuration))
                    .filter(|transaction| transaction_matches_scope(transaction, &scope))
                    .map(|_| configuration.period_start)
                    .min();
                Ok::<_, crate::errors::StorageError>(match (earliest, configuration_earliest) {
                    (Some(left), Some(right)) => Some(left.min(right)),
                    (Some(value), None) | (None, Some(value)) => Some(value),
                    (None, None) => None,
                })
            },
        )?;

        let missing_suffix_period = if let Some(latest) = configurations.last()
            && latest.period_start < current_start
        {
            let scope = budget_scope(latest, &categories)?;
            old_transactions
                .iter()
                .chain(new_transactions)
                .filter(|transaction| {
                    transaction.deleted_at.is_none()
                        && transaction.transaction_date >= latest.period_end
                        && transaction.transaction_date < current_end
                })
                .find(|transaction| transaction_matches_scope(transaction, &scope))
                .map(|_| latest.period_start)
        } else {
            None
        };
        let earliest_period = match (earliest_period, missing_suffix_period) {
            (Some(left), Some(right)) => Some(left.min(right)),
            (Some(value), None) | (None, Some(value)) => Some(value),
            (None, None) => None,
        };

        if let Some(earliest_period) = earliest_period {
            repair_budget_results(conn, &budget_id, earliest_period, now)?;
        } else if configurations.is_empty() {
            materialize_budget(conn, &budget_id, now)?;
        }
    }

    Ok(())
}

fn budget_scope(
    configuration: &BudgetConfigurationRow,
    categories: &[CategoryHierarchy],
) -> crate::errors::Result<Vec<String>> {
    let selected = parse_category_ids(&configuration.category_ids)?;
    Ok(expand_category_scope(&selected, categories))
}

fn transaction_matches_period(
    transaction: &TransactionRow,
    configuration: &BudgetConfigurationRow,
) -> bool {
    transaction.deleted_at.is_none()
        && transaction.transaction_date >= configuration.period_start
        && transaction.transaction_date < configuration.period_end
}

fn transaction_matches_scope(transaction: &TransactionRow, scope: &[String]) -> bool {
    scope.is_empty()
        || transaction
            .transaction_category_id
            .as_ref()
            .is_some_and(|category_id| scope.iter().any(|id| id == category_id))
}
