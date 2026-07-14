use super::models::DomainAlert;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::broadcast;

pub const DOMAIN_ALERT_EVENT_VERSION: u8 = 1;
pub const DOMAIN_ALERT_EVENT_NAME: &str = "domain-alert";
pub const DEFAULT_DOMAIN_ALERT_EVENT_CAPACITY: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DomainAlertEvent {
    Created { alert: Box<DomainAlert> },
    StateChanged,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DomainAlertEventEnvelope {
    pub version: u8,
    #[serde(flatten)]
    pub event: DomainAlertEvent,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum DomainAlertPublicationError {
    #[error("domain alert event serialization failed")]
    Serialization,
    #[error("domain alert event channel unavailable")]
    ChannelUnavailable,
    #[error("domain alert event envelope is invalid")]
    InvalidEnvelope,
}

pub fn serialize_domain_alert_event(
    event: &DomainAlertEvent,
) -> std::result::Result<String, DomainAlertPublicationError> {
    serde_json::to_string(&DomainAlertEventEnvelope {
        version: DOMAIN_ALERT_EVENT_VERSION,
        event: event.clone(),
    })
    .map_err(|_| DomainAlertPublicationError::Serialization)
}

pub fn deserialize_domain_alert_event(
    payload: &str,
) -> std::result::Result<DomainAlertEvent, DomainAlertPublicationError> {
    let envelope = serde_json::from_str::<DomainAlertEventEnvelope>(payload)
        .map_err(|_| DomainAlertPublicationError::InvalidEnvelope)?;
    if envelope.version != DOMAIN_ALERT_EVENT_VERSION {
        return Err(DomainAlertPublicationError::InvalidEnvelope);
    }
    Ok(envelope.event)
}

pub trait DomainAlertEventPublisher: Send + Sync {
    fn publish(
        &self,
        event: &DomainAlertEvent,
    ) -> std::result::Result<(), DomainAlertPublicationError>;
}

#[derive(Clone)]
pub struct DomainAlertEventBus {
    sender: broadcast::Sender<String>,
}

impl DomainAlertEventBus {
    pub fn new() -> Arc<Self> {
        Self::with_capacity(DEFAULT_DOMAIN_ALERT_EVENT_CAPACITY)
    }

    pub fn with_capacity(capacity: usize) -> Arc<Self> {
        let capacity = capacity.max(1);
        let (sender, _) = broadcast::channel(capacity);
        Arc::new(Self { sender })
    }

    pub fn subscribe(&self) -> broadcast::Receiver<String> {
        self.sender.subscribe()
    }

    pub fn receiver_count(&self) -> usize {
        self.sender.receiver_count()
    }
}

impl DomainAlertEventPublisher for DomainAlertEventBus {
    fn publish(
        &self,
        event: &DomainAlertEvent,
    ) -> std::result::Result<(), DomainAlertPublicationError> {
        let payload = serialize_domain_alert_event(event)?;
        self.sender
            .send(payload)
            .map(|_| ())
            .map_err(|_| DomainAlertPublicationError::ChannelUnavailable)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use std::collections::BTreeSet;

    fn sample_alert() -> DomainAlert {
        DomainAlert {
            id: "550e8400-e29b-41d4-a716-446655440000".to_string(),
            producer_key: "budget.status".to_string(),
            occurrence_key: "period-1".to_string(),
            severity: super::super::DomainAlertSeverity::Warning,
            title: "Budget warning".to_string(),
            body: "Budget body".to_string(),
            destination: None,
            data: None,
            created_at: NaiveDate::from_ymd_opt(2026, 7, 14)
                .unwrap()
                .and_hms_opt(12, 0, 0)
                .unwrap(),
            read_at: None,
        }
    }

    #[test]
    fn serializes_created_and_state_changed_with_one_versioned_envelope() {
        let created = serialize_domain_alert_event(&DomainAlertEvent::Created {
            alert: Box::new(sample_alert()),
        })
        .expect("created event should serialize");
        let state_changed = serialize_domain_alert_event(&DomainAlertEvent::StateChanged)
            .expect("state changed event should serialize");

        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&created).expect("created json"),
            serde_json::json!({
                "version": 1,
                "type": "created",
                "alert": {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "producerKey": "budget.status",
                    "occurrenceKey": "period-1",
                    "severity": "warning",
                    "title": "Budget warning",
                    "body": "Budget body",
                    "destination": null,
                    "data": null,
                    "createdAt": "2026-07-14T12:00:00",
                    "readAt": null
                }
            })
        );
        assert_eq!(state_changed, r#"{"version":1,"type":"stateChanged"}"#);
        assert_eq!(
            deserialize_domain_alert_event(&created).expect("created event should decode"),
            DomainAlertEvent::Created {
                alert: Box::new(sample_alert())
            }
        );
        assert_eq!(
            deserialize_domain_alert_event(&state_changed).expect("state changed should decode"),
            DomainAlertEvent::StateChanged
        );
    }

    #[test]
    fn rejects_unknown_event_versions() {
        let payload = r#"{"version":2,"type":"stateChanged"}"#;
        assert_eq!(
            deserialize_domain_alert_event(payload),
            Err(DomainAlertPublicationError::InvalidEnvelope)
        );
    }

    #[test]
    fn shared_serialized_fixtures_decode_with_core_contract() {
        let fixtures = serde_json::from_str::<Vec<serde_json::Value>>(include_str!(
            "../../../../../test-fixtures/domain-alert-events.json"
        ))
        .expect("shared event fixtures should be valid json");

        assert!(
            !fixtures.is_empty(),
            "shared event fixtures should not be empty"
        );
        for fixture in fixtures {
            let payload = serde_json::to_string(&fixture).expect("fixture should serialize");
            deserialize_domain_alert_event(&payload).expect("fixture should match core contract");
        }
    }

    #[tokio::test]
    async fn bounded_bus_reports_lag_without_replay_ids() {
        let bus = DomainAlertEventBus::with_capacity(1);
        let mut receiver = bus.subscribe();
        bus.publish(&DomainAlertEvent::StateChanged)
            .expect("first event should publish");
        bus.publish(&DomainAlertEvent::StateChanged)
            .expect("second event should publish");

        let error = receiver.recv().await.expect_err("receiver should lag");
        assert!(matches!(error, broadcast::error::RecvError::Lagged(1)));
        let payload = receiver.recv().await.expect("latest event should remain");
        let json = serde_json::from_str::<serde_json::Value>(&payload).expect("event json");
        let keys = json
            .as_object()
            .expect("event object")
            .keys()
            .cloned()
            .collect::<BTreeSet<_>>();
        assert_eq!(
            keys,
            BTreeSet::from(["type".to_string(), "version".to_string()])
        );
    }
}
