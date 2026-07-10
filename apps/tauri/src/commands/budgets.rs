use std::sync::Arc;

use log::debug;
use serde::Deserialize;
use tauri::State;
use zai_app::ServiceContext;
use zai_core::features::budgets::models::{Budget, BudgetListStatus, NewBudget};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetListFilters {
    pub status: Option<String>,
}

impl BudgetListFilters {
    fn as_status(&self) -> BudgetListStatus {
        match self.status.as_deref() {
            Some("deactivated") => BudgetListStatus::Deactivated,
            Some("all") => BudgetListStatus::All,
            _ => BudgetListStatus::Active,
        }
    }
}

#[tauri::command]
pub async fn get_budgets(
    filters: Option<BudgetListFilters>,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<Vec<Budget>, String> {
    debug!("Getting budgets ...");
    let status = filters
        .as_ref()
        .map(BudgetListFilters::as_status)
        .unwrap_or(BudgetListStatus::Active);
    state
        .budgets_service()
        .get_budgets(status)
        .map_err(|e| format!("Failed to load budgets: {}", e))
}

#[tauri::command]
pub async fn get_budget(
    budget_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<Budget, String> {
    debug!("Getting budget ...{}", budget_id);
    state
        .budgets_service()
        .get_budget(&budget_id)
        .map_err(|e| format!("Failed to load budget: {}", e))
}

#[tauri::command]
pub async fn create_budget(
    new_budget: NewBudget,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<Budget, String> {
    debug!("Creating budget ...");
    state
        .budgets_service()
        .create_budget(new_budget)
        .await
        .map_err(|e| format!("Failed to create budget: {}", e))
}
