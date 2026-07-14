use std::sync::Arc;

use axum::{
    Json, Router,
    extract::rejection::QueryRejection,
    extract::{Query, State},
    routing::get,
};
use serde::Deserialize;
use zai_app::ServiceContext;
use zai_core::features::domain_alerts::{
    DomainAlertListPage, DomainAlertReadState, DomainAlertSeverity, ListDomainAlertsQuery,
};

use crate::api::error::{bad_request, command_error};

type AlertResult<T> = Result<T, (axum::http::StatusCode, Json<crate::api::error::ApiError>)>;

fn default_limit() -> i64 {
    zai_core::features::domain_alerts::DEFAULT_LIST_LIMIT
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListAlertsQuery {
    cursor: Option<String>,
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    read_state: DomainAlertReadState,
    #[serde(default, deserialize_with = "zai_core::features::domain_alerts::deserialize_optional_severities")]
    severities: Option<Vec<DomainAlertSeverity>>,
}

impl From<ListAlertsQuery> for ListDomainAlertsQuery {
    fn from(value: ListAlertsQuery) -> Self {
        Self {
            cursor: value.cursor,
            limit: Some(value.limit),
            read_state: Some(value.read_state),
            severities: value.severities,
        }
    }
}

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new()
        .route("/alerts", get(list_alerts))
        .route("/alerts/unread-count", get(get_unread_alert_count))
}

async fn list_alerts(
    State(context): State<Arc<ServiceContext>>,
    query: Result<Query<ListAlertsQuery>, QueryRejection>,
) -> AlertResult<Json<DomainAlertListPage>> {
    let Query(query) = query.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .domain_alerts_service()
        .list_alerts(query.into())
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to load alerts", error))
}

async fn get_unread_alert_count(
    State(context): State<Arc<ServiceContext>>,
) -> AlertResult<Json<i64>> {
    context
        .domain_alerts_service()
        .unread_count()
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to load unread alert count", error))
}
