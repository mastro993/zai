use std::sync::Arc;

use log::debug;
use tauri::State;
use zai_app::ServiceContext;
use zai_core::features::budgets::models::{Budget, BudgetPeriodHistory, BudgetUpdate, NewBudget};

use super::{CommandResult, command_error};

#[tauri::command]
pub async fn get_budgets(state: State<'_, Arc<ServiceContext>>) -> CommandResult<Vec<Budget>> {
    debug!("Getting budgets...");
    state
        .budgets_service()
        .list_budgets()
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
