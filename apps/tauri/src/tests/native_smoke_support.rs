use crate::{
    RECURRING_PROCESSING_EVENT_NAME, register_commands, start_alert_event_forwarder,
    start_recurring_processing_forwarder,
};
use chrono::{NaiveDate, NaiveDateTime};
use serde_json::{Value, json};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Listener;
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{
    INVOKE_KEY, MockRuntime, get_ipc_response, mock_builder, mock_context, noop_assets,
};
use tauri::webview::InvokeRequest;
use tauri::{WebviewWindow, WebviewWindowBuilder};
use tokio::sync::mpsc;
use zai_app::bootstrap_context_with_buses_and_clock;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::DomainAlertEventBus;
use zai_core::features::recurring_transactions::{
    RecurringProcessingEvent, RecurringProcessingEventBus, RecurringProcessingFinishState,
    deserialize_recurring_processing_event,
};

pub(crate) fn fixed_now() -> NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 1, 10)
        .expect("fixed date")
        .and_hms_opt(9, 0, 0)
        .expect("fixed time")
}

pub(crate) fn recurring_create_payload(
    description: &str,
    amount: i32,
    transaction_category_id: Option<&str>,
    total_occurrences: i32,
) -> Value {
    json!({
        "newRecurringTransaction": {
            "schedule": {"type": "interval", "every": 1, "unit": "day"},
            "firstScheduledLocal": fixed_now().format("%Y-%m-%dT%H:%M:%S").to_string(),
            "totalOccurrences": total_occurrences,
            "template": {
                "description": description,
                "amount": amount,
                "transactionType": "expense",
                "transactionCategoryId": transaction_category_id,
                "notes": null
            }
        }
    })
}

struct FixedClock {
    now: Mutex<NaiveDateTime>,
}

impl FixedClock {
    fn new(now: NaiveDateTime) -> Self {
        Self {
            now: Mutex::new(now),
        }
    }
}

impl CalendarClock for FixedClock {
    fn sample(&self) -> NaiveDateTime {
        *self.now.lock().expect("fixed clock lock")
    }
}

struct TempDataDir(PathBuf);

static NEXT_TEMP_DATA_DIR: AtomicU64 = AtomicU64::new(1);

impl TempDataDir {
    fn new() -> Self {
        let suffix = NEXT_TEMP_DATA_DIR.fetch_add(1, Ordering::Relaxed);
        Self(std::env::temp_dir().join(format!("zai-tauri-recurring-smoke-{suffix}")))
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDataDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

pub(crate) struct NativeHarness {
    app: tauri::App<MockRuntime>,
    webview: WebviewWindow<MockRuntime>,
    supervisor_handle:
        zai_core::features::recurring_transactions::RecurringProcessingSupervisorHandle,
    processing_events: mpsc::UnboundedReceiver<String>,
    _data_dir: TempDataDir,
}

impl NativeHarness {
    pub(crate) fn new() -> Self {
        let data_dir = TempDataDir::new();
        let processing_bus = RecurringProcessingEventBus::new();
        let alert_bus = DomainAlertEventBus::new();
        let bootstrapped = bootstrap_context_with_buses_and_clock(
            data_dir.path(),
            Arc::clone(&alert_bus),
            Arc::clone(&processing_bus),
            Arc::new(FixedClock::new(fixed_now())),
        )
        .expect("native context should boot");
        let context = Arc::new(bootstrapped.context);
        let supervisor_handle = context.recurring_processing_supervisor();
        let app = register_commands(mock_builder())
            .manage(context.clone())
            .build(mock_context(noop_assets()))
            .expect("mock Tauri app should build");
        let webview = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("mock Tauri webview should build");
        let (sender, processing_events) = mpsc::unbounded_channel();
        let _ = app.listen(RECURRING_PROCESSING_EVENT_NAME, move |event| {
            let payload = event.payload().to_string();
            let payload = serde_json::from_str::<String>(&payload).unwrap_or(payload);
            let _ = sender.send(payload);
        });
        start_alert_event_forwarder(app.handle().clone(), alert_bus);
        start_recurring_processing_forwarder(app.handle().clone(), processing_bus);
        bootstrapped.supervisor.spawn();

        Self {
            app,
            webview,
            supervisor_handle,
            processing_events,
            _data_dir: data_dir,
        }
    }

    pub(crate) fn invoke(&self, command: &str, body: Value) -> Value {
        get_ipc_response(&self.webview, ipc_request(command, body))
            .unwrap_or_else(|error| panic!("{command} should succeed: {error}"))
            .deserialize()
            .expect("IPC response should decode as JSON")
    }

    pub(crate) fn invoke_error(&self, command: &str, body: Value) -> Value {
        get_ipc_response(&self.webview, ipc_request(command, body))
            .expect_err("command should return an IPC error")
    }

    pub(crate) async fn await_finished(&mut self, committed: u32) -> &'static str {
        loop {
            let payload =
                tokio::time::timeout(Duration::from_secs(5), self.processing_events.recv())
                    .await
                    .expect("processing event should arrive")
                    .expect("processing event channel should stay open");
            if let RecurringProcessingEvent::Finished {
                committed: actual_committed,
                state,
                ..
            } = deserialize_recurring_processing_event(&payload).expect("event should decode")
                && actual_committed == committed
            {
                return match state {
                    RecurringProcessingFinishState::CaughtUp => "caughtUp",
                    RecurringProcessingFinishState::Parked => "parked",
                    RecurringProcessingFinishState::ShuttingDown => "shuttingDown",
                    _ => "unexpected",
                };
            }
        }
    }

    pub(crate) async fn shutdown(mut self) {
        self.supervisor_handle.request_shutdown();
        assert_eq!(self.await_finished(0).await, "shuttingDown");
        drop(self.app);
    }
}

fn ipc_request(command: &str, body: Value) -> InvokeRequest {
    InvokeRequest {
        cmd: command.to_string(),
        callback: CallbackFn(0),
        error: CallbackFn(1),
        url: "tauri://localhost".parse().expect("IPC URL"),
        body: InvokeBody::Json(body),
        headers: Default::default(),
        invoke_key: INVOKE_KEY.to_string(),
    }
}
