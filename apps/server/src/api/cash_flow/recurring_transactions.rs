use std::sync::Arc;

use axum::{
    Json, Router,
    extract::rejection::{JsonRejection, QueryRejection},
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
};
use serde::Deserialize;
use zai_app::ServiceContext;
use zai_core::features::recurring_transactions::{
    EditRecurringCount, EditRecurringSchedule, EditRecurringTemplate, NewRecurringTransaction,
    RecurringCreateOutcome, RecurringFeedResult, RecurringMutationOutcome,
    RecurringTransactionDocument, RenameRecurringTransaction,
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
            "/recurring-transactions/{recurring_transaction_id}",
            get(get_recurring_transaction),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/rename",
            post(rename_recurring_transaction),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/schedule",
            post(edit_recurring_schedule),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/template",
            post(edit_recurring_template),
        )
        .route(
            "/recurring-transactions/{recurring_transaction_id}/count",
            post(edit_recurring_count),
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

async fn rename_recurring_transaction(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    payload: Result<Json<RenameRecurringTransaction>, JsonRejection>,
) -> RecurringResult<Json<RecurringMutationOutcome>> {
    let Json(mut input) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    input.recurring_transaction_id = recurring_transaction_id;
    context
        .recurring_transactions_service()
        .rename(input)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to rename recurring transaction", error))
}

async fn edit_recurring_schedule(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    payload: Result<Json<EditRecurringSchedule>, JsonRejection>,
) -> RecurringResult<Json<RecurringMutationOutcome>> {
    let Json(mut input) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    input.recurring_transaction_id = recurring_transaction_id;
    context
        .recurring_transactions_service()
        .edit_schedule(input)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to edit recurring schedule", error))
}

async fn edit_recurring_template(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    payload: Result<Json<EditRecurringTemplate>, JsonRejection>,
) -> RecurringResult<Json<RecurringMutationOutcome>> {
    let Json(mut input) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    input.recurring_transaction_id = recurring_transaction_id;
    context
        .recurring_transactions_service()
        .edit_template(input)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to edit recurring template", error))
}

async fn edit_recurring_count(
    State(context): State<Arc<ServiceContext>>,
    Path(recurring_transaction_id): Path<String>,
    payload: Result<Json<EditRecurringCount>, JsonRejection>,
) -> RecurringResult<Json<RecurringMutationOutcome>> {
    let Json(mut input) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    input.recurring_transaction_id = recurring_transaction_id;
    context
        .recurring_transactions_service()
        .edit_count(input)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to edit recurring count", error))
}
