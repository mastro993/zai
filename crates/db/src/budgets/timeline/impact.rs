use super::calculate::{budget_zone, load_category_hierarchy, parse_cadence, parse_category_ids};
use crate::budgets::models::{BudgetConfigurationRow, BudgetRow};
use crate::errors::IntoStorage;
use crate::schema::{budget_configurations, budgets};
use crate::transactions::models::TransactionRow;
use chrono::{NaiveDate, NaiveDateTime};
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::features::budgets::models::{
    CategoryHierarchy, current_period, expand_category_scope,
};
use zai_core::time::{IanaZone, project_utc_to_local};

#[derive(Debug, Clone)]
pub(super) struct RepairFrontier {
    pub budget_id: String,
    pub earliest_period_start: Option<NaiveDate>,
    pub needs_append: bool,
}

pub(super) fn frontiers_for_transactions(
    conn: &mut SqliteConnection,
    now: NaiveDateTime,
    old_transactions: &[TransactionRow],
    new_transactions: &[TransactionRow],
) -> crate::errors::Result<Vec<RepairFrontier>> {
    if old_transactions.is_empty() && new_transactions.is_empty() {
        return Ok(Vec::new());
    }

    let categories = load_category_hierarchy(conn)?;
    let budget_rows = budgets::table
        .filter(budgets::deleted_at.is_null())
        .load::<BudgetRow>(conn)
        .into_storage()?;

    budget_rows
        .into_iter()
        .filter_map(|budget| {
            frontier_for_budget(
                conn,
                &budget,
                now,
                old_transactions,
                new_transactions,
                &categories,
            )
            .transpose()
        })
        .collect()
}

fn frontier_for_budget(
    conn: &mut SqliteConnection,
    budget: &BudgetRow,
    now: NaiveDateTime,
    old_transactions: &[TransactionRow],
    new_transactions: &[TransactionRow],
    categories: &[CategoryHierarchy],
) -> crate::errors::Result<Option<RepairFrontier>> {
    let budget_id = budget.id.clone();
    let cadence = parse_cadence(budget)?;
    let zone = budget_zone(budget)?;
    let (current_start, current_end) =
        current_period(now, cadence).map_err(crate::errors::StorageError::CoreError)?;
    let (current_start, current_end) = (current_start.date(), current_end.date());
    let configurations = budget_configurations::table
        .filter(budget_configurations::budget_id.eq(&budget_id))
        .order(budget_configurations::period_start.asc())
        .load::<BudgetConfigurationRow>(conn)
        .into_storage()?;

    if configurations.is_empty() {
        return Ok(Some(RepairFrontier {
            budget_id,
            earliest_period_start: None,
            needs_append: true,
        }));
    }

    let earliest_period =
        configurations
            .iter()
            .try_fold(None, |earliest: Option<NaiveDate>, configuration| {
                let scope = budget_scope(configuration, categories)?;
                let configuration_earliest = old_transactions
                    .iter()
                    .chain(new_transactions)
                    .filter(|transaction| {
                        transaction_matches_period(transaction, configuration, &zone)
                    })
                    .filter(|transaction| transaction_matches_scope(transaction, &scope))
                    .map(|_| configuration.period_start)
                    .min();
                Ok::<_, crate::errors::StorageError>(match (earliest, configuration_earliest) {
                    (Some(left), Some(right)) => Some(left.min(right)),
                    (Some(value), None) | (None, Some(value)) => Some(value),
                    (None, None) => None,
                })
            })?;

    let missing_suffix_period = if let Some(latest) = configurations.last()
        && latest.period_start < current_start
    {
        let scope = budget_scope(latest, categories)?;
        old_transactions
            .iter()
            .chain(new_transactions)
            .filter(|transaction| {
                let local_date = transaction_local_date(transaction, &zone);
                transaction.deleted_at.is_none()
                    && local_date >= latest.period_end
                    && local_date < current_end
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

    Ok(earliest_period.map(|earliest_period_start| RepairFrontier {
        budget_id,
        earliest_period_start: Some(earliest_period_start),
        needs_append: false,
    }))
}

fn budget_scope(
    configuration: &BudgetConfigurationRow,
    categories: &[CategoryHierarchy],
) -> crate::errors::Result<Vec<String>> {
    let selected = parse_category_ids(&configuration.category_ids)?;
    Ok(expand_category_scope(&selected, categories))
}

fn transaction_local_date(transaction: &TransactionRow, budget_zone: &IanaZone) -> NaiveDate {
    project_utc_to_local(transaction.transaction_date, budget_zone).date()
}

fn transaction_matches_period(
    transaction: &TransactionRow,
    configuration: &BudgetConfigurationRow,
    budget_zone: &IanaZone,
) -> bool {
    let local_date = transaction_local_date(transaction, budget_zone);
    transaction.deleted_at.is_none()
        && local_date >= configuration.period_start
        && local_date < configuration.period_end
}

fn transaction_matches_scope(transaction: &TransactionRow, scope: &[String]) -> bool {
    scope.is_empty()
        || transaction
            .transaction_category_id
            .as_ref()
            .is_some_and(|category_id| scope.iter().any(|id| id == category_id))
}
