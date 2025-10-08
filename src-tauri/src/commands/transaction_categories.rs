use std::sync::Arc;

use crate::context::ServiceContext;
use log::debug;
use tauri::State;
use zai_core::features::transaction_categories::transaction_categories_models::{
    NewTransactionCategory, TransactionCategory, TransactionCategoryUpdate,
};

#[tauri::command]
pub async fn get_transaction_category(
    category_id: &str,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<TransactionCategory, String> {
    debug!("Getting transaction category...{}", category_id);
    state
        .transaction_categories_service()
        .get_category(category_id)
        .map_err(|e| format!("Failed to get transaction category {}: {}", category_id, e))
}

#[tauri::command]
pub async fn get_transaction_categories(
    parent_id: Option<&str>,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<Vec<TransactionCategory>, String> {
    debug!("Fetching transaction categories...");
    state
        .transaction_categories_service()
        .get_categories(parent_id)
        .map_err(|e| format!("Failed to load transaction_categories: {}", e))
}

#[tauri::command]
pub async fn create_transaction_category(
    new_category: NewTransactionCategory,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<TransactionCategory, String> {
    debug!("Creating transaction category...");
    let category_name = new_category.name.clone();
    state
        .transaction_categories_service()
        .create_category(new_category)
        .await
        .map_err(|e| {
            format!(
                "Failed to create transaction category {}: {}",
                category_name, e
            )
        })
}

#[tauri::command]
pub async fn update_transaction_category(
    updated_category: TransactionCategoryUpdate,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<TransactionCategory, String> {
    debug!("Updating transaction category...");
    let category_name = updated_category.name.clone();
    state
        .transaction_categories_service()
        .update_category(updated_category)
        .await
        .map_err(|e| {
            format!(
                "Failed to update transaction category {}: {}",
                category_name, e
            )
        })
}

#[tauri::command]
pub async fn delete_transaction_categories(
    category_ids: Vec<&str>,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<Vec<TransactionCategory>, String> {
    debug!(
        "Deleting {} transaction categories [{}]...",
        category_ids.len(),
        category_ids.join(", ")
    );
    state
        .transaction_categories_service()
        .delete_categories(category_ids)
        .await
        .map_err(|e| format!("Failed to delete transaction categoris: {}", e))
}

#[tauri::command]
pub async fn import_transaction_categories(
    categories: Vec<NewTransactionCategory>,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<Vec<TransactionCategory>, String> {
    debug!("Importing {} transaction categories...", categories.len());
    state
        .transaction_categories_service()
        .import_categories(categories)
        .await
        .map_err(|e| format!("Failed to import transaction categories: {}", e))
}
