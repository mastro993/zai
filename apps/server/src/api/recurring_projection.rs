use std::sync::Arc;

use axum::{
    Json, Router,
    extract::rejection::QueryRejection,
    extract::{Query, State},
    http::StatusCode,
    routing::get,
};
use serde::Deserialize;
use zai_app::ServiceContext;
use zai_core::features::recurring_transactions::{BudgetProjectionQuery, BudgetProjectionResult};

use crate::api::error::{bad_request, command_error};

type RecurringResult<T> = Result<T, (StatusCode, Json<crate::api::error::ApiError>)>;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectionQuery {
    horizon_months: u32,
    #[serde(default)]
    include_paused_budgets: bool,
    #[serde(default)]
    focus_recurring_transaction_id: Option<String>,
}

pub fn projection_routes() -> Router<Arc<ServiceContext>> {
    Router::new().route(
        "/recurring-transactions/budget-projections",
        get(get_budget_projections),
    )
}

async fn get_budget_projections(
    State(context): State<Arc<ServiceContext>>,
    query: Result<Query<ProjectionQuery>, QueryRejection>,
) -> RecurringResult<Json<BudgetProjectionResult>> {
    let Query(query) = query.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .recurring_transactions_service()
        .project_budgets(BudgetProjectionQuery {
            horizon_months: query.horizon_months,
            include_paused_budgets: query.include_paused_budgets,
            focus_recurring_transaction_id: query.focus_recurring_transaction_id,
        })
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to load budget projections", error))
}
