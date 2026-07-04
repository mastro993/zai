use std::sync::Arc;

use crate::context::ServiceContext;
use log::debug;
use tauri::State;
use zai_core::features::transactions::models::Transaction;

#[tauri::command]
pub async fn get_transaction(
    transaction_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<Transaction, String> {
    debug!("Getting transaction ...{}", transaction_id);
    state
        .transactions_service()
        .get_transaction(&transaction_id)
        .map_err(|e| format!("Failed to load transaction: {}", e))
}
