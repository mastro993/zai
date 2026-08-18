use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    response::sse::{Event, KeepAlive, Sse},
    routing::{get, post},
};
use futures_util::stream::{Stream, StreamExt};
use serde::Deserialize;
use tokio_stream::wrappers::BroadcastStream;
use zai_app::ServiceContext;
use zai_core::features::currency::{
    CurrencyBootstrap, CurrencyJob, CurrencySettingsRow, CurrencyStateEvent, CurrencyStatusView,
    ExchangeRateQuote, SupportedCurrency, serialize_currency_state_event,
};

use crate::api::error::command_error;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteInitialCurrencySetupRequest {
    pub default_currency: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartCurrencyAdditionRequest {
    #[serde(default)]
    pub confirm_provider_disclosure: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartDefaultCurrencyChangeRequest {
    pub code: String,
}

#[derive(Debug, Deserialize)]
pub struct QuoteQuery {
    pub source: String,
    pub target: String,
    pub date: String,
}

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new()
        .route("/currencies/bootstrap", get(get_currency_bootstrap))
        .route("/currencies", get(get_currencies))
        .route("/currencies/catalog", get(get_supported_currencies))
        .route("/currencies/status", get(get_currency_status))
        .route("/currencies/events", get(currency_state_events))
        .route("/currencies/setup", post(complete_initial_currency_setup))
        .route("/currencies/default", post(start_default_currency_change))
        .route(
            "/currencies/jobs/{job_id}/cancel",
            post(cancel_currency_job),
        )
        .route("/currencies/jobs/{job_id}", get(get_currency_job))
        .route("/currencies/{code}/add", post(start_currency_addition))
        .route("/currencies/{code}/disable", post(disable_currency))
        .route("/currencies/{code}", get(get_currency))
        .route(
            "/exchange-rates/quote",
            get(get_transaction_exchange_rate_quote),
        )
        .route("/exchange-rates/refresh", post(retry_exchange_rate_refresh))
}

async fn get_currency_bootstrap(
    State(context): State<Arc<ServiceContext>>,
) -> Result<Json<CurrencyBootstrap>, (axum::http::StatusCode, Json<crate::api::error::ApiError>)> {
    context
        .currency_service()
        .bootstrap()
        .map(Json)
        .map_err(|error| command_error("Failed to load currency bootstrap", error))
}

async fn get_currencies(
    State(context): State<Arc<ServiceContext>>,
) -> Result<
    Json<Vec<CurrencySettingsRow>>,
    (axum::http::StatusCode, Json<crate::api::error::ApiError>),
> {
    context
        .currency_service()
        .list_settings()
        .map(Json)
        .map_err(|error| command_error("Failed to load currencies", error))
}

async fn get_supported_currencies(
    State(context): State<Arc<ServiceContext>>,
) -> Json<Vec<SupportedCurrency>> {
    Json(context.currency_service().supported_catalog())
}

async fn get_currency(
    Path(code): Path<String>,
    State(context): State<Arc<ServiceContext>>,
) -> Result<Json<CurrencySettingsRow>, (axum::http::StatusCode, Json<crate::api::error::ApiError>)>
{
    context
        .currency_service()
        .get_currency(&code)
        .map(Json)
        .map_err(|error| command_error("Failed to load currency", error))
}

async fn complete_initial_currency_setup(
    State(context): State<Arc<ServiceContext>>,
    Json(request): Json<CompleteInitialCurrencySetupRequest>,
) -> Result<Json<CurrencyJob>, (axum::http::StatusCode, Json<crate::api::error::ApiError>)> {
    context
        .currency_service()
        .start_initial_setup(&request.default_currency)
        .map(Json)
        .map_err(|error| command_error("Failed to complete initial currency setup", error))
}

async fn get_currency_job(
    Path(job_id): Path<String>,
    State(context): State<Arc<ServiceContext>>,
) -> Result<Json<CurrencyJob>, (axum::http::StatusCode, Json<crate::api::error::ApiError>)> {
    context
        .currency_service()
        .get_job(&job_id)
        .map(Json)
        .map_err(|error| command_error("Failed to load currency job", error))
}

async fn get_currency_status(
    State(context): State<Arc<ServiceContext>>,
) -> Result<Json<CurrencyStatusView>, (axum::http::StatusCode, Json<crate::api::error::ApiError>)> {
    context
        .currency_service()
        .status()
        .map(Json)
        .map_err(|error| command_error("Failed to load currency status", error))
}

async fn start_currency_addition(
    Path(code): Path<String>,
    State(context): State<Arc<ServiceContext>>,
    Json(request): Json<StartCurrencyAdditionRequest>,
) -> Result<Json<CurrencyJob>, (axum::http::StatusCode, Json<crate::api::error::ApiError>)> {
    let job = context
        .currency_service()
        .start_currency_addition(&code, request.confirm_provider_disclosure)
        .map_err(|error| command_error("Failed to start currency addition", error))?;
    context.spawn_currency_job_drive();
    Ok(Json(job))
}

async fn disable_currency(
    Path(code): Path<String>,
    State(context): State<Arc<ServiceContext>>,
) -> Result<Json<CurrencySettingsRow>, (axum::http::StatusCode, Json<crate::api::error::ApiError>)>
{
    context
        .currency_service()
        .disable_currency(&code)
        .map(Json)
        .map_err(|error| command_error("Failed to disable currency", error))
}

async fn start_default_currency_change(
    State(context): State<Arc<ServiceContext>>,
    Json(request): Json<StartDefaultCurrencyChangeRequest>,
) -> Result<Json<CurrencyJob>, (axum::http::StatusCode, Json<crate::api::error::ApiError>)> {
    let job = context
        .currency_service()
        .start_default_currency_change(&request.code)
        .map_err(|error| command_error("Failed to start default-currency change", error))?;
    context.spawn_currency_job_drive();
    Ok(Json(job))
}

async fn cancel_currency_job(
    Path(job_id): Path<String>,
    State(context): State<Arc<ServiceContext>>,
) -> Result<Json<CurrencyJob>, (axum::http::StatusCode, Json<crate::api::error::ApiError>)> {
    context
        .currency_service()
        .cancel_currency_job(&job_id)
        .map(Json)
        .map_err(|error| command_error("Failed to cancel currency job", error))
}

async fn get_transaction_exchange_rate_quote(
    Query(query): Query<QuoteQuery>,
    State(context): State<Arc<ServiceContext>>,
) -> Result<Json<ExchangeRateQuote>, (axum::http::StatusCode, Json<crate::api::error::ApiError>)> {
    context
        .currency_service()
        .quote(&query.source, &query.target, &query.date)
        .map(Json)
        .map_err(|error| command_error("Failed to load exchange-rate quote", error))
}

async fn retry_exchange_rate_refresh(
    State(context): State<Arc<ServiceContext>>,
) -> Result<Json<()>, (axum::http::StatusCode, Json<crate::api::error::ApiError>)> {
    context.retry_exchange_rate_refresh().await;
    Ok(Json(()))
}

async fn currency_state_events(
    State(context): State<Arc<ServiceContext>>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let receiver = context.currency_state_event_bus().subscribe();
    let stream = BroadcastStream::new(receiver).filter_map(|item| async move {
        match item {
            Ok(payload) => Some(Ok(Event::default().data(payload))),
            Err(tokio_stream::wrappers::errors::BroadcastStreamRecvError::Lagged(_)) => {
                match serialize_currency_state_event(&CurrencyStateEvent::StateChanged) {
                    Ok(payload) => Some(Ok(Event::default().data(payload))),
                    Err(_) => None,
                }
            }
        }
    });

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    )
}
