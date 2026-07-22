use std::sync::Arc;

use log::debug;
use tauri::State;
use zai_app::ServiceContext;
use zai_core::features::recurring_transactions::{
    AdoptRecurringTransaction, AdoptionPreview, AdoptionPreviewRequest,
    GenerationFailureDiagnostics, NewRecurringTransaction, PreviewRecurringGenerationRepair,
    RecurringAdoptOutcome, RecurringBulkExecuteResult, RecurringBulkPreflight,
    RecurringBulkRequest, RecurringCreateOutcome, RecurringFailurePage, RecurringFeedResult,
    RecurringLifecycleOutcome, RecurringLifecycleUpdate, RecurringMatchingIds,
    RecurringMutationOutcome, RecurringOccurrencePage, RecurringRecoveryOutcome,
    RecurringRepairPreview, RecurringTransactionDocument, RepairRecurringGenerationFailure,
    RetryRecurringGenerationFailure, TransactionRecurringProvenance, UpdateRecurringTransaction,
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

#[tauri::command]
pub async fn pause_recurring_transaction(
    recurring_transaction_id: String,
    expected_revision: i32,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringLifecycleOutcome> {
    debug!("Pausing recurring transaction {recurring_transaction_id}...");
    state
        .recurring_transactions_service()
        .pause(RecurringLifecycleUpdate {
            recurring_transaction_id,
            expected_revision,
        })
        .await
        .map_err(|error| command_error("Failed to pause recurring transaction", error))
}

#[tauri::command]
pub async fn resume_recurring_transaction(
    recurring_transaction_id: String,
    expected_revision: i32,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringLifecycleOutcome> {
    debug!("Resuming recurring transaction {recurring_transaction_id}...");
    state
        .recurring_transactions_service()
        .resume(RecurringLifecycleUpdate {
            recurring_transaction_id,
            expected_revision,
        })
        .await
        .map_err(|error| command_error("Failed to resume recurring transaction", error))
}

#[tauri::command]
pub async fn stop_recurring_transaction(
    recurring_transaction_id: String,
    expected_revision: i32,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringLifecycleOutcome> {
    debug!("Stopping recurring transaction {recurring_transaction_id}...");
    state
        .recurring_transactions_service()
        .stop(RecurringLifecycleUpdate {
            recurring_transaction_id,
            expected_revision,
        })
        .await
        .map_err(|error| command_error("Failed to stop recurring transaction", error))
}

#[tauri::command]
pub async fn delete_recurring_transaction(
    recurring_transaction_id: String,
    expected_revision: i32,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringLifecycleOutcome> {
    debug!("Deleting recurring transaction {recurring_transaction_id}...");
    state
        .recurring_transactions_service()
        .delete(RecurringLifecycleUpdate {
            recurring_transaction_id,
            expected_revision,
        })
        .await
        .map_err(|error| command_error("Failed to delete recurring transaction", error))
}

#[tauri::command]
pub async fn preview_recurring_generation_repair(
    request: PreviewRecurringGenerationRepair,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringRepairPreview> {
    debug!(
        "Previewing generation repair for {}...",
        request.recurring_transaction_id
    );
    state
        .recurring_transactions_service()
        .preview_generation_repair(request)
        .await
        .map_err(|error| command_error("Failed to preview generation repair", error))
}

#[tauri::command]
pub async fn repair_recurring_generation_failure(
    input: RepairRecurringGenerationFailure,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringRecoveryOutcome> {
    debug!(
        "Repairing generation failure for {}...",
        input.recurring_transaction_id
    );
    state
        .recurring_transactions_service()
        .repair_and_retry(input)
        .await
        .map_err(|error| command_error("Failed to repair generation failure", error))
}

#[tauri::command]
pub async fn retry_recurring_generation_failure(
    input: RetryRecurringGenerationFailure,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringRecoveryOutcome> {
    debug!(
        "Retrying generation for {}...",
        input.recurring_transaction_id
    );
    state
        .recurring_transactions_service()
        .retry_generation(input)
        .await
        .map_err(|error| command_error("Failed to retry generation", error))
}

#[tauri::command]
pub async fn get_recurring_generation_failure_diagnostics(
    recurring_transaction_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<GenerationFailureDiagnostics> {
    debug!(
        "Copying generation failure diagnostics for {}...",
        recurring_transaction_id
    );
    state
        .recurring_transactions_service()
        .generation_failure_diagnostics(&recurring_transaction_id)
        .await
        .map_err(|error| command_error("Failed to load generation failure diagnostics", error))
}

#[tauri::command]
pub async fn get_recurring_transaction_failure_history(
    recurring_transaction_id: String,
    limit: Option<i64>,
    cursor: Option<String>,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringFailurePage> {
    debug!(
        "Loading failure history for recurring transaction {}...",
        recurring_transaction_id
    );
    state
        .recurring_transactions_service()
        .list_failure_history(&recurring_transaction_id, limit, cursor)
        .await
        .map_err(|error| command_error("Failed to load failure history", error))
}

#[tauri::command]
pub async fn get_matching_recurring_transaction_ids(
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringMatchingIds> {
    debug!("Resolving matching recurring transaction ids...");
    state
        .recurring_transactions_service()
        .list_matching_ids()
        .await
        .map_err(|error| command_error("Failed to resolve matching recurring ids", error))
}

#[tauri::command]
pub async fn preflight_recurring_bulk(
    request: RecurringBulkRequest,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringBulkPreflight> {
    debug!("Preflighting recurring bulk action...");
    state
        .recurring_transactions_service()
        .preflight_bulk(request)
        .await
        .map_err(|error| command_error("Failed to preflight recurring bulk action", error))
}

#[tauri::command]
pub async fn execute_recurring_bulk(
    request: RecurringBulkRequest,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<RecurringBulkExecuteResult> {
    debug!("Executing recurring bulk action...");
    state
        .recurring_transactions_service()
        .execute_bulk(request)
        .await
        .map_err(|error| command_error("Failed to execute recurring bulk action", error))
}
