use std::sync::Arc;

use chrono::NaiveDateTime;
use log::debug;
use serde::Deserialize;
use tauri::State;
use zai_app::ServiceContext;
use zai_core::features::transaction_categories::models::NewTransactionCategory;
use zai_core::features::transactions::models::{
    NewTransaction, Transaction, TransactionSearchFilters, TransactionUpdate,
};
use zai_core::query::{PaginatedData, Sort};

use super::{CommandResult, command_error};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionSearchFiltersDto {
    pub query: Option<String>,
    pub categories: Option<Vec<String>>,
    pub transaction_type: Option<String>,
    pub start_date: Option<NaiveDateTime>,
    pub end_date: Option<NaiveDateTime>,
}

impl TransactionSearchFiltersDto {
    fn as_filters(&self) -> TransactionSearchFilters<'_> {
        TransactionSearchFilters {
            query: self.query.as_deref(),
            categories: self
                .categories
                .as_ref()
                .map(|categories| categories.iter().map(String::as_str).collect()),
            transaction_type: self.transaction_type.as_deref(),
            start_date: self.start_date,
            end_date: self.end_date,
        }
    }
}

#[tauri::command]
pub async fn get_transactions(
    page: i64,
    per_page: i64,
    filters: Option<TransactionSearchFiltersDto>,
    sort: Option<Sort>,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<PaginatedData<Transaction>> {
    debug!("Getting transactions ...");
    let filters = filters
        .as_ref()
        .map(TransactionSearchFiltersDto::as_filters);
    state
        .transactions_service()
        .get_transactions(page, per_page, filters, sort)
        .await
        .map_err(|error| command_error("Failed to load transactions", error))
}

#[tauri::command]
pub async fn get_transaction(
    transaction_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Transaction> {
    debug!("Getting transaction ...{}", transaction_id);
    state
        .transactions_service()
        .get_transaction(&transaction_id)
        .await
        .map_err(|error| command_error("Failed to load transaction", error))
}

#[tauri::command]
pub async fn create_transaction(
    new_transaction: NewTransaction,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Transaction> {
    debug!("Creating transaction ...");
    state
        .transactions_service()
        .create_transaction(new_transaction)
        .await
        .map_err(|error| command_error("Failed to create transaction", error))
}

#[tauri::command]
pub async fn update_transaction(
    updated_transaction: TransactionUpdate,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Transaction> {
    debug!("Updating transaction ...");
    state
        .transactions_service()
        .update_transaction(updated_transaction)
        .await
        .map_err(|error| command_error("Failed to update transaction", error))
}

#[tauri::command]
pub async fn delete_transaction(
    transaction_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Transaction> {
    debug!("Deleting transaction ...{}", transaction_id);
    state
        .transactions_service()
        .delete_transaction(&transaction_id)
        .await
        .map_err(|error| command_error("Failed to delete transaction", error))
}

#[tauri::command]
pub async fn delete_transactions(
    transaction_ids: Vec<String>,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Vec<Transaction>> {
    debug!("Deleting {} transactions ...", transaction_ids.len());
    let transaction_id_refs = transaction_ids.iter().map(String::as_str).collect();
    state
        .transactions_service()
        .delete_transactions(transaction_id_refs)
        .await
        .map_err(|error| command_error("Failed to delete transactions", error))
}

#[tauri::command]
pub async fn import_transactions(
    transactions: Vec<NewTransaction>,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Vec<Transaction>> {
    debug!("Importing {} transactions ...", transactions.len());
    state
        .transactions_service()
        .import_transactions(transactions)
        .await
        .map_err(|error| command_error("Failed to import transactions", error))
}

#[tauri::command]
pub async fn import_transaction_batch(
    categories: Vec<NewTransactionCategory>,
    transactions: Vec<NewTransaction>,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Vec<Transaction>> {
    debug!(
        "Importing transaction batch with {} categories and {} transactions ...",
        categories.len(),
        transactions.len()
    );
    state
        .transactions_service()
        .import_transactions_with_categories(categories, transactions)
        .await
        .map(|(_, imported_transactions)| imported_transactions)
        .map_err(|error| command_error("Failed to import transaction batch", error))
}
