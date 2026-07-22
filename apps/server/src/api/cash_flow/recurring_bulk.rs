use std::sync::Arc;

use axum::{
    Json, Router,
    extract::State,
    extract::rejection::JsonRejection,
    http::StatusCode,
    routing::{get, post},
};
use zai_app::ServiceContext;
use zai_core::features::recurring_transactions::{
    RecurringBulkExecuteResult, RecurringBulkPreflight, RecurringBulkRequest, RecurringMatchingIds,
};

use crate::api::error::{bad_request, command_error};

type RecurringResult<T> = Result<T, (StatusCode, Json<crate::api::error::ApiError>)>;

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new()
        .route(
            "/recurring-transactions/ids",
            get(list_matching_recurring_ids),
        )
        .route(
            "/recurring-transactions/bulk/preflight",
            post(preflight_bulk),
        )
        .route("/recurring-transactions/bulk/execute", post(execute_bulk))
}

async fn list_matching_recurring_ids(
    State(context): State<Arc<ServiceContext>>,
) -> RecurringResult<Json<RecurringMatchingIds>> {
    context
        .recurring_transactions_service()
        .list_matching_ids()
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to resolve matching recurring ids", error))
}

async fn preflight_bulk(
    State(context): State<Arc<ServiceContext>>,
    payload: Result<Json<RecurringBulkRequest>, JsonRejection>,
) -> RecurringResult<Json<RecurringBulkPreflight>> {
    let Json(request) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .preflight_bulk(request)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to preflight recurring bulk action", error))
}

async fn execute_bulk(
    State(context): State<Arc<ServiceContext>>,
    payload: Result<Json<RecurringBulkRequest>, JsonRejection>,
) -> RecurringResult<Json<RecurringBulkExecuteResult>> {
    let Json(request) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .execute_bulk(request)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to execute recurring bulk action", error))
}
