use super::{
    AlertEventEmitter, RecurringProcessingEmitter, forward_alert_events,
    forward_recurring_processing_events,
};
use chrono::{Duration, NaiveDate, NaiveDateTime};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc;
use zai_app::bootstrap_context_with_clock;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::{
    DomainAlertEvent, DomainAlertEventBus, DomainAlertEventPublisher,
    deserialize_domain_alert_event,
};
use zai_core::features::recurring_transactions::{
    NewRecurringTransaction, RecurringCreateOutcome, RecurringProcessingEvent,
    RecurringProcessingEventBus, RecurringProcessingEventPublisher, RecurringTemplateInput,
    ScheduleIntervalUnit, ScheduleRule, deserialize_recurring_processing_event,
};

#[derive(Clone)]
struct FakeEmitter {
    sender: mpsc::UnboundedSender<(String, String)>,
}

struct FixedCalendarClock;

impl CalendarClock for FixedCalendarClock {
    fn sample(&self) -> NaiveDateTime {
        fixed_local()
    }
}

fn fixed_local() -> NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 7, 24)
        .expect("fixed date")
        .and_hms_opt(12, 0, 0)
        .expect("fixed time")
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
    let data_dir = temp_data_dir();
    let zai_app::BootstrappedApp {
        context,
        supervisor,
    } = bootstrap_context_with_clock(&data_dir, Arc::new(FixedCalendarClock))
        .expect("native context should boot");
    let mut events = context.recurring_processing_event_bus().subscribe();
    let supervisor_handle = supervisor.spawn();
    await_finished_event(&mut events).await;
    let first_scheduled_local = fixed_local() - Duration::days(1);

    let created = context
        .recurring_transactions_service()
        .create(NewRecurringTransaction {
            id: Some("native-smoke-recurring".to_string()),
            schedule: ScheduleRule::Interval {
                every: 1,
                unit: ScheduleIntervalUnit::Day,
            },
            first_scheduled_local,
            total_occurrences: Some(1),
            template: RecurringTemplateInput {
                description: "Native smoke recurring".to_string(),
                amount: 1200,
                transaction_type: "expense".to_string(),
                transaction_category_id: None,
                notes: None,
            },
        })
        .await
        .expect("native recurring creation should succeed");
    assert!(matches!(created, RecurringCreateOutcome::Succeeded { .. }));

    await_finished_event(&mut events).await;

    let document = context
        .recurring_transactions_service()
        .get_document("native-smoke-recurring")
        .await
        .expect("native document should load");
    let occurrence = document
        .links
        .occurrences
        .items
        .first()
        .expect("linked occurrence");
    let provenance = context
        .recurring_transactions_service()
        .get_transaction_provenance(&occurrence.transaction_id)
        .await
        .expect("provenance should load")
        .expect("generated transaction should link back");
    assert_eq!(
        provenance.occurrence.transaction_id,
        occurrence.transaction_id
    );
    assert_eq!(
        provenance.source.expect("visible source").id,
        "native-smoke-recurring"
    );

    supervisor_handle.request_shutdown();
    drop(context);
    let _ = fs::remove_dir_all(data_dir);
}

fn temp_data_dir() -> PathBuf {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock should be after epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("zai-tauri-recurring-smoke-{suffix}"))
}

async fn await_finished_event(events: &mut tokio::sync::broadcast::Receiver<String>) {
    loop {
        let payload = events.recv().await.expect("processing event");
        if matches!(
            deserialize_recurring_processing_event(&payload).expect("event should decode"),
            RecurringProcessingEvent::Finished { .. }
        ) {
            break;
        }
    }
}
