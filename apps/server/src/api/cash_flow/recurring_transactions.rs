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
    AdoptRecurringTransaction, AdoptionPreview, AdoptionPreviewRequest, NewRecurringTransaction,
    RecurringAdoptOutcome, RecurringCreateOutcome, RecurringFeedResult, RecurringLifecycleOutcome,
    RecurringLifecycleUpdate, RecurringMutationOutcome, RecurringOccurrencePage,
    RecurringTransactionDocument, TransactionRecurringProvenance, UpdateRecurringTransaction,
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
}

async fn list_recurring_transactions(
    State(context): State<Arc<ServiceContext>>,
    query: Result<Query<FeedQuery>, QueryRejection>,
) -> RecurringResult<Json<RecurringFeedResult>> {
    let Query(query) = query.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .list_feed(Some(query.limit), query.cursor)
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
