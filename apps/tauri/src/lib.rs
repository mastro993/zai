mod commands;

use dotenvy::dotenv;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, RunEvent, Runtime};
use tauri_plugin_log::log::error;
use zai_app::bootstrap_context;
use zai_core::features::domain_alerts::{
    DOMAIN_ALERT_EVENT_NAME, DomainAlertEvent, DomainAlertEventBus, serialize_domain_alert_event,
};
use zai_core::features::recurring_transactions::{
    RECURRING_PROCESSING_EVENT_NAME, RecurringProcessingEvent, RecurringProcessingEventBus,
    serialize_recurring_processing_event,
};

fn start_alert_event_forwarder<R>(handle: AppHandle<R>, event_bus: Arc<DomainAlertEventBus>)
where
    R: Runtime,
{
    tauri::async_runtime::spawn(forward_alert_events(handle, event_bus.subscribe()));
}

fn start_recurring_processing_forwarder<R>(
    handle: AppHandle<R>,
    event_bus: Arc<RecurringProcessingEventBus>,
) where
    R: Runtime,
{
    tauri::async_runtime::spawn(forward_recurring_processing_events(
        handle,
        event_bus.subscribe(),
    ));
}

trait AlertEventEmitter: Send + 'static {
    fn emit_alert_event(&self, payload: String);
}

impl<R: Runtime> AlertEventEmitter for AppHandle<R> {
    fn emit_alert_event(&self, payload: String) {
        let _ = self.emit(DOMAIN_ALERT_EVENT_NAME, payload);
    }
}

trait RecurringProcessingEmitter: Send + 'static {
    fn emit_recurring_processing_event(&self, payload: String);
}

impl<R: Runtime> RecurringProcessingEmitter for AppHandle<R> {
    fn emit_recurring_processing_event(&self, payload: String) {
        let _ = self.emit(RECURRING_PROCESSING_EVENT_NAME, payload);
    }
}

async fn forward_alert_events<E>(emitter: E, mut receiver: tokio::sync::broadcast::Receiver<String>)
where
    E: AlertEventEmitter,
{
    loop {
        let payload = match receiver.recv().await {
            Ok(payload) => payload,
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                match serialize_domain_alert_event(&DomainAlertEvent::StateChanged) {
                    Ok(payload) => payload,
                    Err(_) => continue,
                }
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
        };

        emitter.emit_alert_event(payload);
    }
}

async fn forward_recurring_processing_events<E>(
    emitter: E,
    mut receiver: tokio::sync::broadcast::Receiver<String>,
) where
    E: RecurringProcessingEmitter,
{
    loop {
        let payload = match receiver.recv().await {
            Ok(payload) => payload,
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                match serialize_recurring_processing_event(&RecurringProcessingEvent::StateChanged)
                {
                    Ok(payload) => payload,
                    Err(_) => continue,
                }
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
        };

        emitter.emit_recurring_processing_event(payload);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv().ok();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_, _, _| {}))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(move |app| {
            let handle = app.handle().clone();

            tauri::async_runtime::block_on(async {
                let app_data_dir = handle.path().app_data_dir()?;

                let bootstrapped = match bootstrap_context(&app_data_dir) {
                    Ok(value) => value,
                    Err(e) => {
                        error!("Failed to initialize context: {}", e);
                        return Err(Box::<dyn std::error::Error>::from(e));
                    }
                };

                let alert_bus = bootstrapped.context.domain_alert_event_bus();
                let processing_bus = bootstrapped.context.recurring_processing_event_bus();
                let supervisor_handle = bootstrapped.context.recurring_processing_supervisor();
                handle.manage(Arc::new(bootstrapped.context));
                handle.manage(supervisor_handle);
                let _ = bootstrapped.supervisor.spawn();
                start_alert_event_forwarder(handle.clone(), alert_bus);
                start_recurring_processing_forwarder(handle.clone(), processing_bus);

                Ok(())
            })
            .map_err(|e: Box<dyn std::error::Error>| {
                error!("Critical setup failed: {}", e);
                tauri::Error::Setup(e.into())
            })?;

            Ok(())
        })
        .plugin(
            tauri_plugin_log::Builder::new()
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(10))
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::budgets::get_budgets,
            commands::budgets::get_budget,
            commands::budgets::get_budget_history,
            commands::budgets::create_budget,
            commands::budgets::update_budget,
            commands::budgets::delete_budget,
            commands::budgets::pause_budget,
            commands::budgets::resume_budget,
            commands::recurring_transactions::get_recurring_transactions,
            commands::recurring_transactions::get_recurring_transaction,
            commands::recurring_transactions::get_recurring_transaction_occurrences,
            commands::recurring_transactions::get_transaction_recurring_provenance,
            commands::recurring_transactions::create_recurring_transaction,
            commands::recurring_transactions::update_recurring_transaction,
            commands::recurring_transactions::preview_recurring_adoption,
            commands::recurring_transactions::adopt_recurring_transaction,
            commands::recurring_transactions::pause_recurring_transaction,
            commands::recurring_transactions::resume_recurring_transaction,
            commands::recurring_transactions::stop_recurring_transaction,
            commands::recurring_transactions::delete_recurring_transaction,
            commands::domain_alerts::list_alerts,
            commands::domain_alerts::get_unread_alert_count,
            commands::domain_alerts::mark_all_alerts_read,
            commands::domain_alerts::mark_alert_read,
            commands::domain_alerts::mark_alert_unread,
            commands::transaction_categories::get_transaction_category,
            commands::transaction_categories::get_transaction_categories,
            commands::transaction_categories::create_transaction_category,
            commands::transaction_categories::update_transaction_category,
            commands::transaction_categories::preview_delete_transaction_categories,
            commands::transaction_categories::delete_transaction_categories,
            commands::transaction_categories::import_transaction_categories,
            commands::transactions::get_transactions,
            commands::transactions::get_filtered_transaction_ids,
            commands::transactions::export_transactions_csv,
            commands::transactions::find_existing_duplicate_keys,
            commands::transactions::get_transaction,
            commands::transactions::create_transaction,
            commands::transactions::update_transaction,
            commands::transactions::delete_transaction,
            commands::transactions::delete_transactions,
            commands::transactions::import_transactions,
            commands::transactions::import_transaction_batch,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event
            && let Some(handle) = app_handle.try_state::<zai_core::features::recurring_transactions::RecurringProcessingSupervisorHandle>()
        {
            handle.request_shutdown();
        }
        if let RunEvent::Resumed = event
            && let Some(handle) = app_handle.try_state::<zai_core::features::recurring_transactions::RecurringProcessingSupervisorHandle>()
        {
            handle.request_wake();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{
        AlertEventEmitter, RecurringProcessingEmitter, forward_alert_events,
        forward_recurring_processing_events,
    };
    use tokio::sync::mpsc;
    use zai_core::features::domain_alerts::{
        DomainAlertEvent, DomainAlertEventBus, DomainAlertEventPublisher,
        deserialize_domain_alert_event,
    };
    use zai_core::features::recurring_transactions::{
        RecurringProcessingEvent, RecurringProcessingEventBus, RecurringProcessingEventPublisher,
        deserialize_recurring_processing_event,
    };

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
}
