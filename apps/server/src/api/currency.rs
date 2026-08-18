use std::sync::Arc;

use axum::{Json, Router, extract::State, routing::post};
use serde::{Deserialize, Serialize};
use zai_app::ServiceContext;
use zai_core::features::currency::CurrencySetupState;

use crate::api::error::command_error;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteInitialCurrencySetupRequest {
    pub default_currency: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencySetupStateDto {
    pub default_currency: String,
    pub setup_completed: bool,
}

impl From<CurrencySetupState> for CurrencySetupStateDto {
    fn from(value: CurrencySetupState) -> Self {
        Self {
            default_currency: value.default_currency,
            setup_completed: value.setup_completed,
        }
    }
}

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new().route("/currency/setup", post(complete_initial_currency_setup))
}

async fn complete_initial_currency_setup(
    State(context): State<Arc<ServiceContext>>,
    Json(request): Json<CompleteInitialCurrencySetupRequest>,
) -> Result<Json<CurrencySetupStateDto>, (axum::http::StatusCode, Json<crate::api::error::ApiError>)>
{
    context
        .currency_service()
        .complete_initial_setup(&request.default_currency)
        .map(CurrencySetupStateDto::from)
        .map(Json)
        .map_err(|error| command_error("Failed to complete initial currency setup", error))
}
