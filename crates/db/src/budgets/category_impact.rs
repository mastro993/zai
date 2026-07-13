use super::models::BudgetConfigurationRow;
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{budget_configurations, budgets, transaction_categories};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use std::collections::{HashMap, HashSet};
use zai_core::features::budgets::models::{BudgetCadence, BudgetMeasurementMode, current_period};
use zai_core::features::transaction_categories::models::CategoryRole;
use zai_core::{BudgetImpact, Error};

#[derive(Debug, Clone)]
struct CategoryInfo {
    parent_id: Option<String>,
    role: CategoryRole,
}

#[derive(Debug, Clone)]
struct BudgetScope {
    impact: BudgetImpact,
    measurement_mode: BudgetMeasurementMode,
    current_period_start: NaiveDateTime,
    configurations: Vec<BudgetConfigurationRow>,
}

#[derive(Debug)]
pub(crate) struct DeletionImpact {
    pub ids_to_delete: Vec<String>,
    pub affected_budgets: Vec<BudgetImpact>,
    pub blocked_category_ids: Vec<String>,
}

pub(crate) fn affected_budgets_for_update(
    conn: &mut SqliteConnection,
    category_id: &str,
    old_parent_id: Option<&str>,
    new_parent_id: Option<&str>,
    old_role: CategoryRole,
    new_role: CategoryRole,
    now: NaiveDateTime,
) -> crate::errors::Result<Vec<BudgetImpact>> {
    let categories = load_categories(conn)?;
    let scopes = load_budget_scopes(conn, now)?;
    let role_changed = old_role != new_role;
    let parent_changed = old_parent_id != new_parent_id;
    let mut role_changed_ids = HashSet::from([category_id.to_string()]);

    if role_changed && old_parent_id.is_none() && new_parent_id.is_none() {
        role_changed_ids.extend(
            categories
                .iter()
                .filter(|(_, category)| category.parent_id.as_deref() == Some(category_id))
                .map(|(id, _)| id.clone()),
        );
    }

    let mut affected = Vec::new();
    for scope in scopes {
        let mut budget_is_affected = false;
        for configuration in &scope.configurations {
            let selected = parse_category_ids(&configuration.category_ids)?;
            let selected_set = selected.iter().cloned().collect::<HashSet<_>>();
            let membership_changed = parent_changed
                && [old_parent_id, new_parent_id]
                    .into_iter()
                    .flatten()
                    .any(|parent_id| selected_set.contains(parent_id));
            let role_changed = role_changed
                && scope.measurement_mode == BudgetMeasurementMode::Spending
                && (selected.is_empty()
                    || role_changed_ids.iter().any(|changed_id| {
                        selected_or_covers(&selected_set, changed_id, &categories)
                    }));

            if membership_changed || role_changed {
                budget_is_affected = true;
                break;
            }
        }

        if budget_is_affected {
            affected.push(scope.impact);
        }
    }

    Ok(affected)
}

pub(crate) fn analyze_deletion(
    conn: &mut SqliteConnection,
    requested_ids: &[String],
    children_strategy: zai_core::features::transaction_categories::models::CategoryChildrenDeleteStrategy,
    now: NaiveDateTime,
) -> crate::errors::Result<DeletionImpact> {
    let ids_to_delete = ids_to_delete(conn, requested_ids, children_strategy)?;
    let categories = load_categories(conn)?;
    let scopes = load_budget_scopes(conn, now)?;
    let mut affected_budgets = Vec::new();
    let mut blocked_category_ids = HashSet::new();

    for scope in scopes {
        let mut budget_is_affected = false;
        for configuration in &scope.configurations {
            let selected = parse_category_ids(&configuration.category_ids)?;
            let selected_set = selected.iter().cloned().collect::<HashSet<_>>();
            let current = configuration.period_start == scope.current_period_start;
            let directly_selected = ids_to_delete
                .iter()
                .filter(|id| selected_set.contains(*id))
                .collect::<Vec<_>>();

            if current {
                blocked_category_ids.extend(directly_selected.into_iter().cloned());
            }

            let selected_category_is_affected = ids_to_delete
                .iter()
                .any(|id| selected_or_covers(&selected_set, id, &categories));
            let empty_spending_scope_is_affected = selected.is_empty()
                && scope.measurement_mode == BudgetMeasurementMode::Spending
                && ids_to_delete.iter().any(|id| {
                    categories
                        .get(id)
                        .is_some_and(|category| category.role == CategoryRole::Spending)
                });

            budget_is_affected |= selected_category_is_affected || empty_spending_scope_is_affected;
        }

        if budget_is_affected {
            affected_budgets.push(scope.impact);
        }
    }

    let mut blocked_category_ids = blocked_category_ids.into_iter().collect::<Vec<_>>();
    blocked_category_ids.sort();

    Ok(DeletionImpact {
        ids_to_delete,
        affected_budgets,
        blocked_category_ids,
    })
}

fn ids_to_delete(
    conn: &mut SqliteConnection,
    requested_ids: &[String],
    children_strategy: zai_core::features::transaction_categories::models::CategoryChildrenDeleteStrategy,
) -> crate::errors::Result<Vec<String>> {
    let mut ids = requested_ids.to_vec();
    ids.sort();
    ids.dedup();

    if children_strategy
        == zai_core::features::transaction_categories::models::CategoryChildrenDeleteStrategy::Delete
    {
        let child_ids = transaction_categories::table
            .filter(transaction_categories::parent_id.eq_any(&ids))
            .filter(transaction_categories::deleted_at.is_null())
            .select(transaction_categories::id)
            .load::<String>(conn)
            .into_storage()?;
        ids.extend(child_ids);
        ids.sort();
        ids.dedup();
    }

    Ok(ids)
}

fn load_categories(
    conn: &mut SqliteConnection,
) -> crate::errors::Result<HashMap<String, CategoryInfo>> {
    transaction_categories::table
        .filter(transaction_categories::deleted_at.is_null())
        .select((
            transaction_categories::id,
            transaction_categories::parent_id,
            transaction_categories::role,
        ))
        .load::<(String, Option<String>, String)>(conn)
        .into_storage()?
        .into_iter()
        .map(|(id, parent_id, role)| {
            let role = role.parse::<CategoryRole>().map_err(|_| {
                StorageError::CoreError(Error::Repository(format!("Invalid category role: {role}")))
            })?;
            Ok((id, CategoryInfo { parent_id, role }))
        })
        .collect()
}

fn load_budget_scopes(
    conn: &mut SqliteConnection,
    now: NaiveDateTime,
) -> crate::errors::Result<Vec<BudgetScope>> {
    let budgets = budgets::table
        .filter(budgets::deleted_at.is_null())
        .order((budgets::name.asc(), budgets::id.asc()))
        .select((
            budgets::id,
            budgets::name,
            budgets::cadence,
            budgets::measurement_mode,
        ))
        .load::<(String, String, String, String)>(conn)
        .into_storage()?;
    let configurations = budget_configurations::table
        .order((
            budget_configurations::budget_id.asc(),
            budget_configurations::period_start.asc(),
        ))
        .load::<BudgetConfigurationRow>(conn)
        .into_storage()?
        .into_iter()
        .fold(
            HashMap::<String, Vec<BudgetConfigurationRow>>::new(),
            |mut map, row| {
                map.entry(row.budget_id.clone()).or_default().push(row);
                map
            },
        );

    budgets
        .into_iter()
        .map(|(id, name, cadence, measurement_mode)| {
            let cadence = cadence.parse::<BudgetCadence>().map_err(|_| {
                StorageError::CoreError(Error::Repository("Invalid budget cadence".to_string()))
            })?;
            let measurement_mode =
                measurement_mode
                    .parse::<BudgetMeasurementMode>()
                    .map_err(|_| {
                        StorageError::CoreError(Error::Repository(
                            "Invalid budget measurement mode".to_string(),
                        ))
                    })?;
            let (current_period_start, _) =
                current_period(now, cadence).map_err(StorageError::CoreError)?;
            Ok(BudgetScope {
                impact: BudgetImpact {
                    id: id.clone(),
                    name,
                },
                measurement_mode,
                current_period_start,
                configurations: configurations.get(&id).cloned().unwrap_or_default(),
            })
        })
        .collect()
}

fn parse_category_ids(value: &str) -> crate::errors::Result<Vec<String>> {
    serde_json::from_str(value).map_err(|_| {
        StorageError::CoreError(Error::Repository(
            "Invalid budget category scope".to_string(),
        ))
    })
}

fn selected_or_covers(
    selected: &HashSet<String>,
    category_id: &str,
    categories: &HashMap<String, CategoryInfo>,
) -> bool {
    let mut current = Some(category_id);
    let mut visited = HashSet::new();
    while let Some(id) = current {
        if !visited.insert(id) {
            return false;
        }
        if selected.contains(id) {
            return true;
        }
        current = categories
            .get(id)
            .and_then(|category| category.parent_id.as_deref());
    }
    false
}
