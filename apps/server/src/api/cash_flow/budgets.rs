use std::sync::Arc;

use axum::{
    Json, Router,
    extract::rejection::JsonRejection,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
};
use serde::Deserialize;
use zai_app::ServiceContext;
use zai_core::features::budgets::models::{Budget, BudgetListStatus, NewBudget};

use crate::api::error::{bad_request, command_error};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListBudgetsQuery {
    pub status: Option<String>,
}

impl ListBudgetsQuery {
    fn as_status(&self) -> BudgetListStatus {
        match self.status.as_deref() {
            Some("deactivated") => BudgetListStatus::Deactivated,
            Some("all") => BudgetListStatus::All,
            _ => BudgetListStatus::Active,
        }
    }
}

type BudgetResult<T> = Result<T, (StatusCode, Json<crate::api::error::ApiError>)>;

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new()
        .route("/budgets", get(list_budgets).post(create_budget))
        .route("/budgets/{budget_id}", get(get_budget))
}

pub async fn list_budgets(
    State(context): State<Arc<ServiceContext>>,
    Query(query): Query<ListBudgetsQuery>,
) -> BudgetResult<Json<Vec<Budget>>> {
    context
        .budgets_service()
        .get_budgets(query.as_status())
        .map(Json)
        .map_err(|error| command_error("Failed to load budgets", error))
}

pub async fn get_budget(
    State(context): State<Arc<ServiceContext>>,
    Path(budget_id): Path<String>,
) -> BudgetResult<Json<Budget>> {
    context
        .budgets_service()
        .get_budget(&budget_id)
        .map(Json)
        .map_err(|error| command_error(&format!("Failed to load budget {budget_id}"), error))
}

pub async fn create_budget(
    State(context): State<Arc<ServiceContext>>,
    payload: Result<Json<NewBudget>, JsonRejection>,
) -> BudgetResult<(StatusCode, Json<Budget>)> {
    let Json(new_budget) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    let budget_name = new_budget.name.clone();
    context
        .budgets_service()
        .create_budget(new_budget)
        .await
        .map(|budget| (StatusCode::CREATED, Json(budget)))
        .map_err(|error| {
            command_error(
                &format!("Failed to create budget {budget_name}"),
                error,
            )
        })
}
