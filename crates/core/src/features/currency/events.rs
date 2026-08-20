use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::broadcast;

use super::models::{CurrencyJobFinishState, CurrencyJobType};

pub const CURRENCY_STATE_EVENT_VERSION: u8 = 1;
pub const CURRENCY_STATE_EVENT_NAME: &str = "currency-state";
pub const DEFAULT_CURRENCY_STATE_EVENT_CAPACITY: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CurrencyStateEvent {
    Started {
        #[serde(rename = "jobId")]
        job_id: String,
        #[serde(rename = "jobType")]
        job_type: CurrencyJobType,
    },
    Progress {
        #[serde(rename = "jobId")]
        job_id: String,
        #[serde(rename = "jobType")]
        job_type: CurrencyJobType,
        #[serde(rename = "stageCurrent")]
        stage_current: u32,
        #[serde(rename = "stageTotal")]
        stage_total: u32,
    },
    Finished {
        #[serde(rename = "jobId")]
        job_id: String,
        #[serde(rename = "jobType")]
        job_type: CurrencyJobType,
        #[serde(rename = "stageCurrent")]
        stage_current: u32,
        #[serde(rename = "stageTotal")]
        stage_total: u32,
        state: CurrencyJobFinishState,
    },
    RefreshProgress {
        current: u32,
        total: u32,
    },
    StateChanged,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CurrencyStateEventEnvelope {
    pub version: u8,
    #[serde(flatten)]
    pub event: CurrencyStateEvent,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum CurrencyStatePublicationError {
    #[error("currency-state event serialization failed")]
    Serialization,
    #[error("currency-state event channel unavailable")]
    ChannelUnavailable,
    #[error("currency-state event envelope is invalid")]
    InvalidEnvelope,
}

pub fn serialize_currency_state_event(
    event: &CurrencyStateEvent,
) -> std::result::Result<String, CurrencyStatePublicationError> {
    serde_json::to_string(&CurrencyStateEventEnvelope {
        version: CURRENCY_STATE_EVENT_VERSION,
        event: event.clone(),
    })
    .map_err(|_| CurrencyStatePublicationError::Serialization)
}

pub fn deserialize_currency_state_event(
    payload: &str,
) -> std::result::Result<CurrencyStateEvent, CurrencyStatePublicationError> {
    let envelope = serde_json::from_str::<CurrencyStateEventEnvelope>(payload)
        .map_err(|_| CurrencyStatePublicationError::InvalidEnvelope)?;
    if envelope.version != CURRENCY_STATE_EVENT_VERSION {
        return Err(CurrencyStatePublicationError::InvalidEnvelope);
    }
    Ok(envelope.event)
}

pub trait CurrencyStateEventPublisher: Send + Sync {
    fn publish(
        &self,
        event: &CurrencyStateEvent,
    ) -> std::result::Result<(), CurrencyStatePublicationError>;
}

#[derive(Clone)]
pub struct CurrencyStateEventBus {
    sender: broadcast::Sender<String>,
}

impl CurrencyStateEventBus {
    pub fn new() -> Arc<Self> {
        Self::with_capacity(DEFAULT_CURRENCY_STATE_EVENT_CAPACITY)
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

impl CurrencyStateEventPublisher for CurrencyStateEventBus {
    fn publish(
        &self,
        event: &CurrencyStateEvent,
    ) -> std::result::Result<(), CurrencyStatePublicationError> {
        let payload = serialize_currency_state_event(event)?;
        self.sender
            .send(payload)
            .map(|_| ())
            .map_err(|_| CurrencyStatePublicationError::ChannelUnavailable)
    }
}

pub struct NoopCurrencyStatePublisher;

impl CurrencyStateEventPublisher for NoopCurrencyStatePublisher {
    fn publish(
        &self,
        _event: &CurrencyStateEvent,
    ) -> std::result::Result<(), CurrencyStatePublicationError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    #[test]
    fn serializes_versioned_progress_without_financial_fields() {
        let payload = serialize_currency_state_event(&CurrencyStateEvent::Progress {
            job_id: "job-1".into(),
            job_type: CurrencyJobType::Setup,
            stage_current: 1,
            stage_total: 1,
        })
        .expect("serialize");
        let json: serde_json::Value = serde_json::from_str(&payload).expect("json");
        assert_eq!(json["version"], 1);
        assert_eq!(json["type"], "progress");
        assert_eq!(json["jobId"], "job-1");
        assert_eq!(json["jobType"], "setup");
        let keys = json
            .as_object()
            .expect("object")
            .keys()
            .cloned()
            .collect::<BTreeSet<_>>();
        assert!(!keys.iter().any(|key| {
            let lower = key.to_ascii_lowercase();
            lower.contains("amount")
                || lower.contains("description")
                || lower.contains("category")
                || lower.contains("note")
        }));
    }

    #[test]
    fn serializes_refresh_progress_counts_only() {
        let payload = serialize_currency_state_event(&CurrencyStateEvent::RefreshProgress {
            current: 3,
            total: 28,
        })
        .expect("serialize");
        let json: serde_json::Value = serde_json::from_str(&payload).expect("json");
        assert_eq!(json["version"], 1);
        assert_eq!(json["type"], "refreshProgress");
        assert_eq!(json["current"], 3);
        assert_eq!(json["total"], 28);
        let keys = json
            .as_object()
            .expect("object")
            .keys()
            .cloned()
            .collect::<BTreeSet<_>>();
        assert_eq!(
            keys,
            ["current", "total", "type", "version"]
                .into_iter()
                .map(ToOwned::to_owned)
                .collect()
        );
    }

    #[test]
    fn rejects_unknown_event_versions() {
        let payload = r#"{"version":2,"type":"stateChanged"}"#;
        assert_eq!(
            deserialize_currency_state_event(payload),
            Err(CurrencyStatePublicationError::InvalidEnvelope)
        );
    }

    #[test]
    fn shared_serialized_fixtures_decode_with_core_contract() {
        let fixtures = serde_json::from_str::<Vec<serde_json::Value>>(include_str!(
            "../../../../../test-fixtures/currency-state-events.json"
        ))
        .expect("shared event fixtures should be valid json");
        assert!(!fixtures.is_empty());
        for fixture in fixtures {
            let payload = serde_json::to_string(&fixture).expect("fixture should serialize");
            deserialize_currency_state_event(&payload).expect("fixture should match core contract");
        }
    }

    #[tokio::test]
    async fn bounded_bus_reports_lag_without_replay_ids() {
        let bus = CurrencyStateEventBus::with_capacity(1);
        let mut receiver = bus.subscribe();
        bus.publish(&CurrencyStateEvent::StateChanged)
            .expect("first");
        bus.publish(&CurrencyStateEvent::StateChanged)
            .expect("second");
        let error = receiver.recv().await.expect_err("lag");
        assert!(matches!(error, broadcast::error::RecvError::Lagged(1)));
    }
}
