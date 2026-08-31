mod commands;
mod linux_client_chrome;
mod macos_traffic_lights;

use std::{path::PathBuf, sync::Arc};
use tauri::{AppHandle, Emitter, Manager, RunEvent, Runtime};
use tauri_plugin_log::log::{LevelFilter, error};
use zai_app::bootstrap_context;
use zai_core::features::currency::{
    CURRENCY_STATE_EVENT_NAME, CurrencyStateEvent, CurrencyStateEventBus,
    serialize_currency_state_event,
};
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

fn start_currency_state_forwarder<R>(handle: AppHandle<R>, event_bus: Arc<CurrencyStateEventBus>)
where
    R: Runtime,
{
    tauri::async_runtime::spawn(forward_currency_state_events(handle, event_bus.subscribe()));
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

trait CurrencyStateEmitter: Send + 'static {
    fn emit_currency_state_event(&self, payload: String);
}

impl<R: Runtime> CurrencyStateEmitter for AppHandle<R> {
    fn emit_currency_state_event(&self, payload: String) {
        let _ = self.emit(CURRENCY_STATE_EVENT_NAME, payload);
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

async fn forward_currency_state_events<E>(
    emitter: E,
    mut receiver: tokio::sync::broadcast::Receiver<String>,
) where
    E: CurrencyStateEmitter,
{
    loop {
        let payload = match receiver.recv().await {
            Ok(payload) => payload,
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                match serialize_currency_state_event(&CurrencyStateEvent::StateChanged) {
                    Ok(payload) => payload,
                    Err(_) => continue,
                }
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
        };

        emitter.emit_currency_state_event(payload);
    }
}

fn register_commands<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.invoke_handler(tauri::generate_handler![
        commands::currency::get_currency_bootstrap,
        commands::currency::get_currencies,
        commands::currency::get_supported_currencies,
        commands::currency::get_currency,
        commands::currency::complete_initial_currency_setup,
        commands::currency::get_currency_job,
        commands::currency::get_currency_status,
        commands::currency::start_currency_addition,
        commands::currency::disable_currency,
        commands::currency::start_default_currency_change,
        commands::currency::cancel_currency_job,
        commands::currency::get_transaction_exchange_rate_quote,
        commands::currency::retry_exchange_rate_refresh,
        commands::diagnostics::get_diagnostics,
        commands::diagnostics::show_database_in_folder,
        commands::diagnostics::show_logs_in_folder,
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
        commands::recurring_transactions::get_recurring_budget_projections,
        commands::recurring_transactions::get_transaction_recurring_provenance,
        commands::recurring_transactions::create_recurring_transaction,
        commands::recurring_transactions::update_recurring_transaction,
        commands::recurring_transactions::preview_recurring_adoption,
        commands::recurring_transactions::adopt_recurring_transaction,
        commands::recurring_transactions::pause_recurring_transaction,
        commands::recurring_transactions::resume_recurring_transaction,
        commands::recurring_transactions::stop_recurring_transaction,
        commands::recurring_transactions::delete_recurring_transaction,
        commands::recurring_transactions::preview_recurring_generation_repair,
        commands::recurring_transactions::repair_recurring_generation_failure,
        commands::recurring_transactions::retry_recurring_generation_failure,
        commands::recurring_transactions::get_recurring_generation_failure_diagnostics,
        commands::recurring_transactions::get_recurring_transaction_failure_history,
        commands::recurring_transactions::get_matching_recurring_transaction_ids,
        commands::recurring_transactions::preflight_recurring_bulk,
        commands::recurring_transactions::execute_recurring_bulk,
        commands::recurring_transactions::get_recurring_processing_status,
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
        commands::transactions::preview_transaction_import,
        commands::transactions::get_transaction_import_preview,
        commands::transactions::commit_transaction_import,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = register_commands(
        tauri::Builder::default()
            .plugin(tauri_plugin_process::init())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_single_instance::init(|_, _, _| {}))
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_fs::init())
            .setup(move |app| {
                let handle = app.handle().clone();

                tauri::async_runtime::block_on(async {
                    let zai_home = std::env::var_os("ZAI_HOME")
                        .map(PathBuf::from)
                        .unwrap_or(handle.path().home_dir()?.join(".zai"));

                    let bootstrapped = match bootstrap_context(&zai_home) {
                        Ok(value) => value,
                        Err(e) => {
                            error!("Failed to initialize context: {}", e);
                            return Err(Box::<dyn std::error::Error>::from(e));
                        }
                    };

                    let context = Arc::new(bootstrapped.context);
                    let alert_bus = context.domain_alert_event_bus();
                    let processing_bus = context.recurring_processing_event_bus();
                    let currency_bus = context.currency_state_event_bus();
                    let supervisor_handle = context.recurring_processing_supervisor();
                    let currency_refresh_handle = context.currency_refresh_supervisor();
                    handle.manage(Arc::clone(&context));
                    handle.manage(supervisor_handle);
                    handle.manage(currency_refresh_handle);
                    let _ = bootstrapped.supervisor.spawn();
                    std::mem::drop(bootstrapped.currency_refresh.spawn());
                    context.adopt_leftover_currency_jobs();
                    start_alert_event_forwarder(handle.clone(), alert_bus);
                    start_recurring_processing_forwarder(handle.clone(), processing_bus);
                    start_currency_state_forwarder(handle.clone(), currency_bus);

                    Ok(())
                })
                .map_err(|e: Box<dyn std::error::Error>| {
                    error!("Critical setup failed: {}", e);
                    tauri::Error::Setup(e.into())
                })?;

                if let Some(main_window) = app.get_webview_window("main") {
                    macos_traffic_lights::install(&main_window);
                    linux_client_chrome::install(&main_window);
                }

                Ok(())
            })
            .plugin(
                tauri_plugin_log::Builder::new()
                    .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(10))
                    .level(if cfg!(debug_assertions) {
                        LevelFilter::Debug
                    } else {
                        LevelFilter::Info
                    })
                    // reqwest's default retry policy traces "shouldn't retry!" on every
                    // successful GET. ECB history refresh is one request per year.
                    .level_for("reqwest", LevelFilter::Warn)
                    .level_for("hyper", LevelFilter::Warn)
                    .level_for("hyper_util", LevelFilter::Warn)
                    .level_for("h2", LevelFilter::Warn)
                    .level_for("rustls", LevelFilter::Warn)
                    .level_for("tower", LevelFilter::Warn)
                    .build(),
            ),
    )
    .build(tauri::generate_context!())
    .expect("error while running tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event
            && let Some(handle) = app_handle.try_state::<zai_core::features::recurring_transactions::RecurringProcessingSupervisorHandle>()
        {
            handle.request_shutdown();
        }
        if let RunEvent::Resumed = event {
            if let Some(handle) = app_handle.try_state::<zai_core::features::recurring_transactions::RecurringProcessingSupervisorHandle>()
            {
                handle.request_wake();
            }
            if let Some(handle) = app_handle.try_state::<zai_app::CurrencyRefreshHandle>() {
                handle.request_wake();
            }
        }
    });
}

#[cfg(test)]
mod tests;
