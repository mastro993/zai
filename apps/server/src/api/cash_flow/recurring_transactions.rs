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
    NewRecurringTransaction, RecurringCreateOutcome, RecurringFeedResult,
    RecurringTransactionDocument,
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
