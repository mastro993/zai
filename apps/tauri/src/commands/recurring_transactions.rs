use std::sync::Arc;

use log::debug;
use tauri::State;
use zai_app::ServiceContext;
use zai_core::features::recurring_transactions::{
    EditRecurringCount, EditRecurringSchedule, EditRecurringTemplate, NewRecurringTransaction,
    RecurringCreateOutcome, RecurringFeedResult, RecurringMutationOutcome,
    RecurringTransactionDocument, RenameRecurringTransaction,
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
pub async fn rename_recurring_transaction(
    input: RenameRecurringTransaction,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringMutationOutcome> {
    debug!(
        "Renaming recurring transaction {}...",
        input.recurring_transaction_id
    );
    state
        .recurring_transactions_service()
        .rename(input)
        .await
        .map_err(|error| command_error("Failed to rename recurring transaction", error))
}

#[tauri::command]
pub async fn edit_recurring_schedule(
    input: EditRecurringSchedule,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringMutationOutcome> {
    debug!(
        "Editing recurring schedule {}...",
        input.recurring_transaction_id
    );
    state
        .recurring_transactions_service()
        .edit_schedule(input)
        .await
        .map_err(|error| command_error("Failed to edit recurring schedule", error))
}

#[tauri::command]
pub async fn edit_recurring_template(
    input: EditRecurringTemplate,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringMutationOutcome> {
    debug!(
        "Editing recurring template {}...",
        input.recurring_transaction_id
    );
    state
        .recurring_transactions_service()
        .edit_template(input)
        .await
        .map_err(|error| command_error("Failed to edit recurring template", error))
}

#[tauri::command]
pub async fn edit_recurring_count(
    input: EditRecurringCount,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringMutationOutcome> {
    debug!(
        "Editing recurring count {}...",
        input.recurring_transaction_id
    );
    state
        .recurring_transactions_service()
        .edit_count(input)
        .await
        .map_err(|error| command_error("Failed to edit recurring count", error))
}
