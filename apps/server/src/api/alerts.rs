use std::{convert::Infallible, sync::Arc, time::Duration};

use axum::{
    Json, Router,
    extract::rejection::QueryRejection,
    extract::{Path, Query, State},
    response::sse::{Event, KeepAlive, Sse},
    routing::{get, post},
};
use futures_util::{Stream, StreamExt, stream::unfold};
use serde::Deserialize;
use zai_app::ServiceContext;
use zai_core::features::domain_alerts::{
    DomainAlert, DomainAlertEvent, DomainAlertListPage, DomainAlertReadState, DomainAlertSeverity,
    ListDomainAlertsQuery, serialize_domain_alert_event,
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
    #[serde(
        default,
        deserialize_with = "zai_core::features::domain_alerts::deserialize_optional_severities"
    )]
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
        .route("/alerts/events", get(stream_alerts))
        .route("/alerts/unread-count", get(get_unread_alert_count))
        .route("/alerts/mark-all-read", post(mark_all_alerts_read))
        .route("/alerts/{alert_id}/read", post(mark_alert_read))
        .route("/alerts/{alert_id}/unread", post(mark_alert_unread))
}

async fn stream_alerts(
    State(context): State<Arc<ServiceContext>>,
) -> Sse<impl Stream<Item = std::result::Result<Event, Infallible>>> {
    let receiver = context.domain_alert_event_bus().subscribe();
    let stream = alert_event_stream(receiver).map(|payload| Ok(Event::default().data(payload)));

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keepalive"),
    )
}

fn alert_event_stream(
    receiver: tokio::sync::broadcast::Receiver<String>,
) -> impl Stream<Item = String> {
    unfold(receiver, |mut receiver| async move {
        match receiver.recv().await {
            Ok(payload) => Some((payload, receiver)),
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                let payload = serialize_domain_alert_event(&DomainAlertEvent::StateChanged).ok()?;
                Some((payload, receiver))
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => None,
        }
    })
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

async fn mark_all_alerts_read(
    State(context): State<Arc<ServiceContext>>,
) -> AlertResult<Json<i64>> {
    context
        .domain_alerts_service()
        .mark_all_read()
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to mark all alerts read", error))
}

async fn mark_alert_read(
    State(context): State<Arc<ServiceContext>>,
    Path(alert_id): Path<String>,
) -> AlertResult<Json<DomainAlert>> {
    context
        .domain_alerts_service()
        .mark_read(&alert_id)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to mark alert read", error))
}

async fn mark_alert_unread(
    State(context): State<Arc<ServiceContext>>,
    Path(alert_id): Path<String>,
) -> AlertResult<Json<DomainAlert>> {
    context
        .domain_alerts_service()
        .mark_unread(&alert_id)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to mark alert unread", error))
}

#[cfg(test)]
mod tests {
    use super::alert_event_stream;
    use futures_util::StreamExt;
    use zai_core::features::domain_alerts::{
        DomainAlertEvent, DomainAlertEventBus, DomainAlertEventPublisher,
        deserialize_domain_alert_event,
    };

    #[tokio::test]
    async fn lag_emits_one_state_changed_hint_without_replay_metadata() {
        let bus = DomainAlertEventBus::with_capacity(1);
        let stream = alert_event_stream(bus.subscribe());
        bus.publish(&DomainAlertEvent::StateChanged)
            .expect("first event should publish");
        bus.publish(&DomainAlertEvent::StateChanged)
            .expect("second event should publish");

        futures_util::pin_mut!(stream);
        let payload = stream.next().await.expect("lag should produce a hint");
        assert_eq!(
            deserialize_domain_alert_event(&payload).expect("hint should decode"),
            DomainAlertEvent::StateChanged
        );
        let json = serde_json::from_str::<serde_json::Value>(&payload).expect("event json");
        assert!(json.get("id").is_none());
        assert!(json.get("lastEventId").is_none());
    }
}
