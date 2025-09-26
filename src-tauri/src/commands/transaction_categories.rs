use std::sync::Arc;

use crate::context::ServiceContext;
use log::debug;
use tauri::State;
use zai_core::features::transaction_categories::transaction_categories_models::TransactionCategory;

#[tauri::command]
pub async fn get_transaction_categories(
    state: State<'_, Arc<ServiceContext>>,
) -> Result<Vec<TransactionCategory>, String> {
    debug!("Fetching transaction categories...");
    state
        .transaction_categories_service()
        .get_all_categories()
        .map_err(|e| format!("Failed to load transaction_categories: {}", e))
}
