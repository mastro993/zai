use std::sync::Arc;

use axum::{
    Json, Router,
    extract::rejection::JsonRejection,
    extract::{Path, State},
    http::StatusCode,
    routing::get,
};
use zai_app::ServiceContext;
use zai_core::features::budgets::models::{Budget, NewBudget};

use crate::api::error::{bad_request, command_error};

type BudgetResult<T> = Result<T, (StatusCode, Json<crate::api::error::ApiError>)>;

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new()
        .route("/budgets", get(list_budgets).post(create_budget))
        .route("/budgets/{budget_id}", get(get_budget))
}

async fn list_budgets(
    State(context): State<Arc<ServiceContext>>,
) -> BudgetResult<Json<Vec<Budget>>> {
    context
        .budgets_service()
        .list_budgets()
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to load budgets", error))
}

async fn get_budget(
    State(context): State<Arc<ServiceContext>>,
    Path(budget_id): Path<String>,
) -> BudgetResult<Json<Budget>> {
    context
        .budgets_service()
        .get_budget(&budget_id)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to load budget", error))
}

async fn create_budget(
    State(context): State<Arc<ServiceContext>>,
    payload: Result<Json<NewBudget>, JsonRejection>,
) -> BudgetResult<(StatusCode, Json<Budget>)> {
    let Json(new_budget) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .budgets_service()
        .create_budget(new_budget)
        .await
        .map(|budget| (StatusCode::CREATED, Json(budget)))
        .map_err(|error| command_error("Failed to create budget", error))
}
