use std::sync::Arc;

use log::debug;
use tauri::State;
use zai_app::ServiceContext;
use zai_core::features::recurring_transactions::{
    AdoptRecurringTransaction, AdoptionPreview, AdoptionPreviewRequest, NewRecurringTransaction,
    RecurringAdoptOutcome, RecurringCreateOutcome, RecurringFeedResult, RecurringMutationOutcome,
    RecurringOccurrencePage, RecurringTransactionDocument, TransactionRecurringProvenance,
    UpdateRecurringTransaction,
};

use super::{CommandResult, command_error};

#[tauri::command]
pub async fn get_recurring_transactions(
    limit: Option<i64>,
    cursor: Option<String>,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringFeedResult> {
    debug!("Getting recurring transactions feed...");
    state
        .recurring_transactions_service()
        .list_feed(limit, cursor)
        .await
        .map_err(|error| command_error("Failed to load recurring transactions", error))
}

#[tauri::command]
pub async fn get_recurring_transaction(
    recurring_transaction_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringTransactionDocument> {
    debug!(
        "Getting recurring transaction {}...",
        recurring_transaction_id
    );
    state
        .recurring_transactions_service()
        .get_document(&recurring_transaction_id)
        .await
        .map_err(|error| command_error("Failed to load recurring transaction", error))
}

#[tauri::command]
pub async fn get_recurring_transaction_occurrences(
    recurring_transaction_id: String,
    limit: Option<i64>,
    cursor: Option<String>,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringOccurrencePage> {
    debug!(
        "Getting occurrences for recurring transaction {}...",
        recurring_transaction_id
    );
    state
        .recurring_transactions_service()
        .list_linked_occurrences(&recurring_transaction_id, limit, cursor)
        .await
        .map_err(|error| command_error("Failed to load recurring occurrences", error))
}

#[tauri::command]
pub async fn get_transaction_recurring_provenance(
    transaction_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Option<TransactionRecurringProvenance>> {
    debug!(
        "Getting recurring provenance for transaction {}...",
        transaction_id
    );
    state
        .recurring_transactions_service()
        .get_transaction_provenance(&transaction_id)
        .await
        .map_err(|error| command_error("Failed to load transaction provenance", error))
}

#[tauri::command]
pub async fn create_recurring_transaction(
    new_recurring_transaction: NewRecurringTransaction,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringCreateOutcome> {
    debug!("Creating recurring transaction...");
    state
        .recurring_transactions_service()
        .create(new_recurring_transaction)
        .await
        .map_err(|error| command_error("Failed to create recurring transaction", error))
}

#[tauri::command]
pub async fn update_recurring_transaction(
    input: UpdateRecurringTransaction,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringMutationOutcome> {
    debug!(
        "Updating recurring transaction {}...",
        input.recurring_transaction_id
    );
    state
        .recurring_transactions_service()
        .update(input)
        .await
        .map_err(|error| command_error("Failed to update recurring transaction", error))
}

#[tauri::command]
pub async fn preview_recurring_adoption(
    request: AdoptionPreviewRequest,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<AdoptionPreview> {
    debug!("Previewing recurring adoption...");
    state
        .recurring_transactions_service()
        .preview_adoption(request)
        .await
        .map_err(|error| command_error("Failed to preview adoption", error))
}

#[tauri::command]
pub async fn adopt_recurring_transaction(
    request: AdoptRecurringTransaction,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringAdoptOutcome> {
    debug!("Adopting transaction as recurring occurrence one...");
    state
        .recurring_transactions_service()
        .adopt(request)
        .await
        .map_err(|error| command_error("Failed to adopt transaction", error))
}
