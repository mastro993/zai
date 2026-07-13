use std::sync::Arc;

use log::debug;
use tauri::State;
use zai_app::ServiceContext;
use zai_core::features::budgets::models::{
    Budget, BudgetLifecycleUpdate, BudgetListFilter, BudgetPeriodHistory, BudgetUpdate, NewBudget,
};

use super::{CommandResult, command_error};

#[tauri::command]
pub async fn get_budgets(
    filter: Option<BudgetListFilter>,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Vec<Budget>> {
    debug!("Getting budgets...");
    state
        .budgets_service()
        .list_budgets(filter.unwrap_or_default())
        .await
        .map_err(|error| command_error("Failed to load budgets", error))
}

#[tauri::command]
pub async fn get_budget(
    budget_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Budget> {
    debug!("Getting budget {}...", budget_id);
    state
        .budgets_service()
        .get_budget(&budget_id)
        .await
        .map_err(|error| command_error("Failed to load budget", error))
}

#[tauri::command]
pub async fn get_budget_history(
    budget_id: String,
    page: Option<i64>,
    per_page: Option<i64>,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<BudgetPeriodHistory> {
    debug!("Getting budget history {}...", budget_id);
    state
        .budgets_service()
        .get_budget_history(&budget_id, page.unwrap_or(1), per_page.unwrap_or(50))
        .await
        .map_err(|error| command_error("Failed to load budget history", error))
}

#[tauri::command]
pub async fn create_budget(
    new_budget: NewBudget,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Budget> {
    debug!("Creating budget...");
    state
        .budgets_service()
        .create_budget(new_budget)
        .await
        .map_err(|error| command_error("Failed to create budget", error))
}

#[tauri::command]
pub async fn update_budget(
    budget_id: String,
    updated_budget: BudgetUpdate,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Budget> {
    debug!("Updating budget {}...", budget_id);
    state
        .budgets_service()
        .update_budget(&budget_id, updated_budget)
        .await
        .map_err(|error| command_error("Failed to update budget", error))
}

#[tauri::command]
pub async fn delete_budget(
    budget_id: String,
    expected_revision: i64,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<()> {
    debug!("Deleting budget {}...", budget_id);
    state
        .budgets_service()
        .delete_budget(&budget_id, BudgetLifecycleUpdate { expected_revision })
        .await
        .map_err(|error| command_error("Failed to delete budget", error))
}

#[tauri::command]
pub async fn pause_budget(
    budget_id: String,
    expected_revision: i64,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Budget> {
    debug!("Pausing budget {}...", budget_id);
    state
        .budgets_service()
        .pause_budget(&budget_id, BudgetLifecycleUpdate { expected_revision })
        .await
        .map_err(|error| command_error("Failed to pause budget", error))
}

#[tauri::command]
pub async fn resume_budget(
    budget_id: String,
    expected_revision: i64,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Budget> {
    debug!("Resuming budget {}...", budget_id);
    state
        .budgets_service()
        .resume_budget(&budget_id, BudgetLifecycleUpdate { expected_revision })
        .await
        .map_err(|error| command_error("Failed to resume budget", error))
}
