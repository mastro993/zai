use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::broadcast;

pub const RECURRING_PROCESSING_EVENT_VERSION: u8 = 1;
pub const RECURRING_PROCESSING_EVENT_NAME: &str = "recurring-processing";
pub const DEFAULT_RECURRING_PROCESSING_EVENT_CAPACITY: usize = 256;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecurringProcessingFinishState {
    CaughtUp,
    BudgetExhausted,
    Parked,
    TransientlyDelayed,
    Cancelled,
    ShuttingDown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum RecurringProcessingEvent {
    Started {
        #[serde(rename = "runId")]
        run_id: String,
    },
    Progress {
        #[serde(rename = "runId")]
        run_id: String,
        committed: u32,
        #[serde(rename = "alreadyFulfilled")]
        already_fulfilled: u32,
        #[serde(rename = "moreDueRemaining")]
        more_due_remaining: bool,
    },
    Finished {
        #[serde(rename = "runId")]
        run_id: String,
        committed: u32,
        #[serde(rename = "alreadyFulfilled")]
        already_fulfilled: u32,
        #[serde(rename = "moreDueRemaining")]
        more_due_remaining: bool,
        state: RecurringProcessingFinishState,
    },
    StateChanged,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecurringProcessingEventEnvelope {
    pub version: u8,
    #[serde(flatten)]
    pub event: RecurringProcessingEvent,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum RecurringProcessingPublicationError {
    #[error("recurring processing event serialization failed")]
    Serialization,
    #[error("recurring processing event channel unavailable")]
    ChannelUnavailable,
    #[error("recurring processing event envelope is invalid")]
    InvalidEnvelope,
}

pub fn serialize_recurring_processing_event(
    event: &RecurringProcessingEvent,
) -> std::result::Result<String, RecurringProcessingPublicationError> {
    serde_json::to_string(&RecurringProcessingEventEnvelope {
        version: RECURRING_PROCESSING_EVENT_VERSION,
        event: event.clone(),
    })
    .map_err(|_| RecurringProcessingPublicationError::Serialization)
}

pub fn deserialize_recurring_processing_event(
    payload: &str,
) -> std::result::Result<RecurringProcessingEvent, RecurringProcessingPublicationError> {
    let envelope = serde_json::from_str::<RecurringProcessingEventEnvelope>(payload)
        .map_err(|_| RecurringProcessingPublicationError::InvalidEnvelope)?;
    if envelope.version != RECURRING_PROCESSING_EVENT_VERSION {
        return Err(RecurringProcessingPublicationError::InvalidEnvelope);
    }
    Ok(envelope.event)
}

pub trait RecurringProcessingEventPublisher: Send + Sync {
    fn publish(
        &self,
        event: &RecurringProcessingEvent,
    ) -> std::result::Result<(), RecurringProcessingPublicationError>;
}

#[derive(Clone)]
pub struct RecurringProcessingEventBus {
    sender: broadcast::Sender<String>,
}

impl RecurringProcessingEventBus {
    pub fn new() -> Arc<Self> {
        Self::with_capacity(DEFAULT_RECURRING_PROCESSING_EVENT_CAPACITY)
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

impl RecurringProcessingEventPublisher for RecurringProcessingEventBus {
    fn publish(
        &self,
        event: &RecurringProcessingEvent,
    ) -> std::result::Result<(), RecurringProcessingPublicationError> {
        let payload = serialize_recurring_processing_event(event)?;
        self.sender
            .send(payload)
            .map(|_| ())
            .map_err(|_| RecurringProcessingPublicationError::ChannelUnavailable)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    #[test]
    fn serializes_versioned_progress_without_financial_fields() {
        let payload = serialize_recurring_processing_event(&RecurringProcessingEvent::Progress {
            run_id: "run-1".into(),
            committed: 2,
            already_fulfilled: 1,
            more_due_remaining: true,
        })
        .expect("serialize");
        let json: serde_json::Value = serde_json::from_str(&payload).expect("json");
        assert_eq!(json["version"], 1);
        assert_eq!(json["type"], "progress");
        assert_eq!(json["runId"], "run-1");
        assert_eq!(json["committed"], 2);
        assert_eq!(json["alreadyFulfilled"], 1);
        assert_eq!(json["moreDueRemaining"], true);
        let keys = json
            .as_object()
            .expect("object")
            .keys()
            .cloned()
            .collect::<BTreeSet<_>>();
        assert!(!keys.iter().any(|key| {
            key.to_ascii_lowercase().contains("amount")
                || key.to_ascii_lowercase().contains("name")
                || key.to_ascii_lowercase().contains("account")
        }));
    }

    #[test]
    fn rejects_unknown_event_versions() {
        let payload = r#"{"version":2,"type":"stateChanged"}"#;
        assert_eq!(
            deserialize_recurring_processing_event(payload),
            Err(RecurringProcessingPublicationError::InvalidEnvelope)
        );
    }

    #[tokio::test]
    async fn bounded_bus_reports_lag_without_replay_ids() {
        let bus = RecurringProcessingEventBus::with_capacity(1);
        let mut receiver = bus.subscribe();
        bus.publish(&RecurringProcessingEvent::StateChanged)
            .expect("first");
        bus.publish(&RecurringProcessingEvent::StateChanged)
            .expect("second");
        let error = receiver.recv().await.expect_err("lag");
        assert!(matches!(error, broadcast::error::RecvError::Lagged(1)));
    }
}
