use std::sync::Arc;

use axum::{
    Json, Router,
    extract::rejection::{JsonRejection, QueryRejection},
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
};
use serde::Deserialize;
use zai_app::ServiceContext;
use zai_core::features::recurring_transactions::{
    AdoptRecurringTransaction, AdoptionPreview, AdoptionPreviewRequest,
    GenerationFailureDiagnostics, NewRecurringTransaction, PreviewRecurringGenerationRepair,
    RecurringAdoptOutcome, RecurringCreateOutcome, RecurringFailurePage, RecurringFeedFilters,
    RecurringFeedResult, RecurringLifecycle, RecurringLifecycleOutcome, RecurringLifecycleUpdate,
    RecurringMutationOutcome, RecurringOccurrencePage, RecurringRecoveryOutcome,
    RecurringRepairPreview, RecurringTransactionDocument, RepairRecurringGenerationFailure,
    RetryRecurringGenerationFailure, TransactionRecurringProvenance, UpdateRecurringTransaction,
};

use crate::api::error::{bad_request, command_error};

type RecurringResult<T> = Result<T, (StatusCode, Json<crate::api::error::ApiError>)>;

fn default_limit() -> i64 {
    50
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FeedQuery {
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    cursor: Option<String>,
    #[serde(default)]
    search: Option<String>,
    #[serde(default)]
    lifecycle: Option<RecurringLifecycle>,
    #[serde(default)]
    needs_attention: Option<bool>,
}

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new()
        .route(
            "/recurring-transactions",
            get(list_recurring_transactions).post(create_recurring_transaction),
        )
        .route(
            "/recurring-transactions/adoption-preview",
            axum::routing::post(preview_adoption),
        )
        .route(
            "/recurring-transactions/adopt",
            axum::routing::post(adopt_recurring_transaction),
        )
        .route(
            "/recurring-transactions/provenance/{transaction_id}",
            get(get_transaction_provenance),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}",
            get(get_recurring_transaction).post(update_recurring_transaction),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/occurrences",
            get(list_recurring_occurrences),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/pause",
            axum::routing::post(pause_recurring_transaction),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/resume",
            axum::routing::post(resume_recurring_transaction),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/stop",
            axum::routing::post(stop_recurring_transaction),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/delete",
            axum::routing::post(delete_recurring_transaction),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/failures",
            get(list_failure_history),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/repair/preview",
            axum::routing::post(preview_generation_repair),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/repair",
            axum::routing::post(repair_generation_failure),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/retry",
            axum::routing::post(retry_generation_failure),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/diagnostics",
            get(generation_failure_diagnostics),
        )
}

async fn list_recurring_transactions(
    State(context): State<Arc<ServiceContext>>,
    query: Result<Query<FeedQuery>, QueryRejection>,
) -> RecurringResult<Json<RecurringFeedResult>> {
    let Query(query) = query.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .list_feed_filtered(
            Some(query.limit),
            query.cursor,
            RecurringFeedFilters {
                search: query.search,
                lifecycle: query.lifecycle,
                needs_attention: query.needs_attention,
            },
        )
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to load recurring transactions", error))
}

async fn get_recurring_transaction(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
) -> RecurringResult<Json<RecurringTransactionDocument>> {
    context
        .recurring_transactions_service()
        .get_document(&recurring_transaction_id)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to load recurring transaction", error))
}

async fn list_recurring_occurrences(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    query: Result<Query<FeedQuery>, QueryRejection>,
) -> RecurringResult<Json<RecurringOccurrencePage>> {
    let Query(query) = query.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .list_linked_occurrences(&recurring_transaction_id, Some(query.limit), query.cursor)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to load recurring occurrences", error))
}

async fn get_transaction_provenance(
    State(context): State<Arc<ServiceContext>>,
    Path(transaction_id): Path<String>,
) -> RecurringResult<Json<Option<TransactionRecurringProvenance>>> {
    context
        .recurring_transactions_service()
        .get_transaction_provenance(&transaction_id)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to load transaction provenance", error))
}

async fn create_recurring_transaction(
    State(context): State<Arc<ServiceContext>>,
    payload: Result<Json<NewRecurringTransaction>, JsonRejection>,
) -> RecurringResult<(StatusCode, Json<RecurringCreateOutcome>)> {
    let Json(new_recurring_transaction) =
        payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .create(new_recurring_transaction)
        .await
        .map(|outcome| (StatusCode::CREATED, Json(outcome)))
        .map_err(|error| command_error("Failed to create recurring transaction", error))
}

async fn update_recurring_transaction(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    payload: Result<Json<UpdateRecurringTransaction>, JsonRejection>,
) -> RecurringResult<Json<RecurringMutationOutcome>> {
    let Json(mut input) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    input.recurring_transaction_id = recurring_transaction_id;
    context
        .recurring_transactions_service()
        .update(input)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to update recurring transaction", error))
}

async fn preview_adoption(
    State(context): State<Arc<ServiceContext>>,
    payload: Result<Json<AdoptionPreviewRequest>, JsonRejection>,
) -> RecurringResult<Json<AdoptionPreview>> {
    let Json(request) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .preview_adoption(request)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to preview adoption", error))
}

async fn adopt_recurring_transaction(
    State(context): State<Arc<ServiceContext>>,
    payload: Result<Json<AdoptRecurringTransaction>, JsonRejection>,
) -> RecurringResult<(StatusCode, Json<RecurringAdoptOutcome>)> {
    let Json(request) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .adopt(request)
        .await
        .map(|outcome| (StatusCode::CREATED, Json(outcome)))
        .map_err(|error| command_error("Failed to adopt transaction", error))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LifecycleBody {
    expected_revision: i32,
}

async fn pause_recurring_transaction(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    payload: Result<Json<LifecycleBody>, JsonRejection>,
) -> RecurringResult<Json<RecurringLifecycleOutcome>> {
    let Json(body) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .pause(RecurringLifecycleUpdate {
            recurring_transaction_id,
            expected_revision: body.expected_revision,
        })
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to pause recurring transaction", error))
}

async fn resume_recurring_transaction(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    payload: Result<Json<LifecycleBody>, JsonRejection>,
) -> RecurringResult<Json<RecurringLifecycleOutcome>> {
    let Json(body) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .resume(RecurringLifecycleUpdate {
            recurring_transaction_id,
            expected_revision: body.expected_revision,
        })
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to resume recurring transaction", error))
}

async fn stop_recurring_transaction(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    payload: Result<Json<LifecycleBody>, JsonRejection>,
) -> RecurringResult<Json<RecurringLifecycleOutcome>> {
    let Json(body) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .stop(RecurringLifecycleUpdate {
            recurring_transaction_id,
            expected_revision: body.expected_revision,
        })
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to stop recurring transaction", error))
}

async fn delete_recurring_transaction(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    payload: Result<Json<LifecycleBody>, JsonRejection>,
) -> RecurringResult<Json<RecurringLifecycleOutcome>> {
    let Json(body) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .delete(RecurringLifecycleUpdate {
            recurring_transaction_id,
            expected_revision: body.expected_revision,
        })
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to delete recurring transaction", error))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FailureHistoryQuery {
    #[serde(default = "default_failure_limit")]
    limit: i64,
    #[serde(default)]
    cursor: Option<String>,
}

fn default_failure_limit() -> i64 {
    20
}

async fn list_failure_history(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    query: Result<Query<FailureHistoryQuery>, QueryRejection>,
) -> RecurringResult<Json<RecurringFailurePage>> {
    let Query(query) = query.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .list_failure_history(&recurring_transaction_id, Some(query.limit), query.cursor)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to load failure history", error))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepairBody {
    expected_revision: i32,
    repair_field_key: zai_core::features::recurring_transactions::RecurringRepairField,
    template: zai_core::features::recurring_transactions::RecurringTemplateInput,
}

async fn preview_generation_repair(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    payload: Result<Json<RepairBody>, JsonRejection>,
) -> RecurringResult<Json<RecurringRepairPreview>> {
    let Json(body) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .preview_generation_repair(PreviewRecurringGenerationRepair {
            recurring_transaction_id,
            repair_field_key: body.repair_field_key,
            template: body.template,
        })
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to preview generation repair", error))
}

async fn repair_generation_failure(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    payload: Result<Json<RepairBody>, JsonRejection>,
) -> RecurringResult<Json<RecurringRecoveryOutcome>> {
    let Json(body) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .repair_and_retry(RepairRecurringGenerationFailure {
            recurring_transaction_id,
            expected_revision: body.expected_revision,
            repair_field_key: body.repair_field_key,
            template: body.template,
        })
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to repair generation failure", error))
}

async fn retry_generation_failure(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    payload: Result<Json<LifecycleBody>, JsonRejection>,
) -> RecurringResult<Json<RecurringRecoveryOutcome>> {
    let Json(body) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .retry_generation(RetryRecurringGenerationFailure {
            recurring_transaction_id,
            expected_revision: body.expected_revision,
        })
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to retry generation", error))
}

async fn generation_failure_diagnostics(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
) -> RecurringResult<Json<GenerationFailureDiagnostics>> {
    context
        .recurring_transactions_service()
        .generation_failure_diagnostics(&recurring_transaction_id)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to load generation failure diagnostics", error))
}
