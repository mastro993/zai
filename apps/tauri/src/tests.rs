use super::{
    AlertEventEmitter, RecurringProcessingEmitter, forward_alert_events,
    forward_recurring_processing_events,
};
use serde_json::json;
use tokio::sync::mpsc;
use zai_core::features::domain_alerts::{
    DomainAlertEvent, DomainAlertEventBus, DomainAlertEventPublisher,
    deserialize_domain_alert_event,
};
use zai_core::features::recurring_transactions::{
    RecurringProcessingEvent, RecurringProcessingEventBus, RecurringProcessingEventPublisher,
    deserialize_recurring_processing_event,
};

mod native_smoke_support;
use native_smoke_support::{NativeHarness, fixed_now, recurring_create_payload};

#[derive(Clone)]
struct FakeEmitter {
    sender: mpsc::UnboundedSender<(String, String)>,
}

impl AlertEventEmitter for FakeEmitter {
    fn emit_alert_event(&self, payload: String) {
        let _ = self.sender.send(("domain-alert".to_string(), payload));
    }
}

impl RecurringProcessingEmitter for FakeEmitter {
    fn emit_recurring_processing_event(&self, payload: String) {
        let _ = self
            .sender
            .send(("recurring-processing".to_string(), payload));
    }
}

#[tokio::test]
async fn forwards_events_to_one_application_wide_emitter() {
    let bus = DomainAlertEventBus::with_capacity(2);
    let (sender, mut receiver) = mpsc::unbounded_channel();
    let task = tokio::spawn(forward_alert_events(
        FakeEmitter { sender },
        bus.subscribe(),
    ));

    bus.publish(&DomainAlertEvent::StateChanged)
        .expect("event should publish");
    let (name, payload) = receiver.recv().await.expect("forwarded event");

    assert_eq!(name, "domain-alert");
    assert_eq!(
        deserialize_domain_alert_event(&payload).expect("forwarded event should decode"),
        DomainAlertEvent::StateChanged
    );
    task.abort();
}

#[tokio::test]
async fn collapses_broadcast_lag_to_one_reconciliation_hint() {
    let bus = DomainAlertEventBus::with_capacity(1);
    let (sender, mut receiver) = mpsc::unbounded_channel();
    let task = tokio::spawn(forward_alert_events(
        FakeEmitter { sender },
        bus.subscribe(),
    ));

    bus.publish(&DomainAlertEvent::StateChanged)
        .expect("first event should publish");
    bus.publish(&DomainAlertEvent::StateChanged)
        .expect("second event should publish");
    let (_, payload) = receiver.recv().await.expect("lag hint");

    assert_eq!(
        deserialize_domain_alert_event(&payload).expect("lag hint should decode"),
        DomainAlertEvent::StateChanged
    );
    task.abort();
}

#[tokio::test]
async fn forwards_recurring_processing_lag_as_state_changed() {
    let bus = RecurringProcessingEventBus::with_capacity(1);
    let (sender, mut receiver) = mpsc::unbounded_channel();
    let task = tokio::spawn(forward_recurring_processing_events(
        FakeEmitter { sender },
        bus.subscribe(),
    ));

    bus.publish(&RecurringProcessingEvent::StateChanged)
        .expect("first");
    bus.publish(&RecurringProcessingEvent::StateChanged)
        .expect("second");
    let (name, payload) = receiver.recv().await.expect("lag hint");
    assert_eq!(name, "recurring-processing");
    assert_eq!(
        deserialize_recurring_processing_event(&payload).expect("decode"),
        RecurringProcessingEvent::StateChanged
    );
    task.abort();
}

#[tokio::test]
async fn native_recurring_workflow_smoke_boots_processes_and_resolves_links() {
    let mut native = NativeHarness::new();
    assert_eq!(native.await_finished(0).await, "caughtUp");

    let error = native.invoke_error(
        "create_recurring_transaction",
        json!({
            "newRecurringTransaction": {
                "schedule": {"type": "interval", "every": 1, "unit": "day"},
                "firstScheduledLocal": fixed_now().format("%Y-%m-%dT%H:%M:%S").to_string(),
                "totalOccurrences": 1,
                "template": {
                    "description": "Invalid native recurring",
                    "amount": -1,
                    "transactionType": "expense",
                    "transactionCategoryId": null,
                    "notes": null
                }
            }
        }),
    );
    assert_eq!(error["code"], "validation");
    assert!(
        error["message"]
            .as_str()
            .unwrap_or_default()
            .contains("amount")
    );

    native.invoke(
        "create_budget",
        json!({
            "newBudget": {
                "name": "Native smoke budget",
                "baseAllowance": 10000,
                "cadence": "month",
                "categoryIds": [],
                "measurementMode": "spending",
                "rolloverMode": "off",
                "warningPercentage": 80
            }
        }),
    );

    let created = native.invoke(
        "create_recurring_transaction",
        recurring_create_payload("Native smoke recurring", 1200, None, 2),
    );
    assert_eq!(created["outcome"], "succeeded");
    let created_document = &created["document"];
    let recurring_id = created_document["recurringTransaction"]["id"]
        .as_str()
        .expect("create response should contain recurring id")
        .to_string();
    for key in [
        "recurringTransaction",
        "schedule",
        "template",
        "occurrenceSummary",
        "links",
        "failures",
        "budgetImpact",
    ] {
        assert!(
            created_document.get(key).is_some(),
            "document missing {key}"
        );
    }
    assert_eq!(created_document["budgetImpact"]["state"], "ready");
    assert_eq!(created_document["failures"]["state"], "empty");

    let finished = native.await_finished(1).await;
    assert_eq!(finished, "caughtUp");

    let document = native.invoke(
        "get_recurring_transaction",
        json!({"recurringTransactionId": recurring_id}),
    );
    assert_eq!(document["recurringTransaction"]["lifecycle"], "active");
    assert_eq!(
        document["links"]["occurrences"]["items"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(document["budgetImpact"]["state"], "ready");
    assert_eq!(document["failures"]["state"], "empty");

    let occurrences = native.invoke(
        "get_recurring_transaction_occurrences",
        json!({"recurringTransactionId": recurring_id, "limit": 50}),
    );
    let occurrence = occurrences["items"]
        .as_array()
        .and_then(|items| items.first())
        .expect("one generated occurrence");
    let transaction_id = occurrence["transactionId"]
        .as_str()
        .expect("occurrence should link transaction")
        .to_string();
    let transaction = native.invoke("get_transaction", json!({"transactionId": transaction_id}));
    assert_eq!(transaction["description"], "Native smoke recurring");
    assert_eq!(transaction["amount"], 1200);

    let transactions = native.invoke(
        "get_transactions",
        json!({
            "page": 1,
            "perPage": 50,
            "filters": {"query": "Native smoke recurring"},
            "sort": null
        }),
    );
    let matching_transaction_ids = transactions["data"]
        .as_array()
        .expect("transaction feed should return data")
        .iter()
        .filter_map(|item| item["id"].as_str())
        .collect::<Vec<_>>();
    assert_eq!(matching_transaction_ids, vec![transaction_id.as_str()]);

    let provenance = native.invoke(
        "get_transaction_recurring_provenance",
        json!({"transactionId": transaction_id}),
    );
    assert_eq!(provenance["occurrence"]["transactionId"], transaction_id);
    assert_eq!(provenance["source"]["id"], recurring_id);

    let failure_history = native.invoke(
        "get_recurring_transaction_failure_history",
        json!({"recurringTransactionId": recurring_id, "limit": 20}),
    );
    assert_eq!(failure_history["items"].as_array().unwrap().len(), 0);

    let revision = document["recurringTransaction"]["revision"]
        .as_i64()
        .expect("document revision");
    let paused = native.invoke(
        "pause_recurring_transaction",
        json!({"recurringTransactionId": recurring_id, "expectedRevision": revision}),
    );
    assert_eq!(
        paused["document"]["recurringTransaction"]["lifecycle"],
        "paused"
    );
    let paused_revision = paused["document"]["recurringTransaction"]["revision"]
        .as_i64()
        .expect("paused revision");
    let resumed = native.invoke(
        "resume_recurring_transaction",
        json!({"recurringTransactionId": recurring_id, "expectedRevision": paused_revision}),
    );
    assert_eq!(
        resumed["document"]["recurringTransaction"]["lifecycle"],
        "active"
    );
    let resumed_revision = resumed["document"]["recurringTransaction"]["revision"]
        .as_i64()
        .expect("resumed revision");
    let stopped = native.invoke(
        "stop_recurring_transaction",
        json!({"recurringTransactionId": recurring_id, "expectedRevision": resumed_revision}),
    );
    assert_eq!(
        stopped["document"]["recurringTransaction"]["lifecycle"],
        "stopped"
    );
    assert_eq!(
        stopped["document"]["links"]["occurrences"]["items"]
            .as_array()
            .unwrap()
            .len(),
        1
    );

    native.shutdown().await;
}
