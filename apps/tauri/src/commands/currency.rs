use std::sync::Arc;

use tauri::State;
use zai_app::ServiceContext;
use zai_core::features::currency::{
    CurrencyBootstrap, CurrencyJob, CurrencySettingsRow, CurrencyStatusView, ExchangeRateQuote,
    SupportedCurrency,
};

use super::{CommandResult, command_error};

#[tauri::command]
pub async fn get_currency_bootstrap(
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<CurrencyBootstrap> {
    state
        .currency_service()
        .bootstrap()
        .map_err(|error| command_error("Failed to load currency bootstrap", error))
}

#[tauri::command]
pub async fn get_currencies(
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Vec<CurrencySettingsRow>> {
    state
        .currency_service()
        .list_settings()
        .map_err(|error| command_error("Failed to load currencies", error))
}

#[tauri::command]
pub async fn get_supported_currencies(
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<Vec<SupportedCurrency>> {
    Ok(state.currency_service().supported_catalog())
}

#[tauri::command]
pub async fn get_currency(
    code: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<CurrencySettingsRow> {
    state
        .currency_service()
        .get_currency(&code)
        .map_err(|error| command_error("Failed to load currency", error))
}

#[tauri::command]
pub async fn complete_initial_currency_setup(
    default_currency: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<CurrencyJob> {
    state
        .currency_service()
        .start_initial_setup(&default_currency)
        .map_err(|error| command_error("Failed to complete initial currency setup", error))
}

#[tauri::command]
pub async fn get_currency_job(
    job_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<CurrencyJob> {
    state
        .currency_service()
        .get_job(&job_id)
        .map_err(|error| command_error("Failed to load currency job", error))
}

#[tauri::command]
pub async fn get_currency_status(
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<CurrencyStatusView> {
    state
        .currency_service()
        .status()
        .map_err(|error| command_error("Failed to load currency status", error))
}

#[tauri::command]
pub async fn start_currency_addition(
    code: String,
    confirm_provider_disclosure: bool,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<CurrencyJob> {
    let job = state
        .currency_service()
        .start_currency_addition(&code, confirm_provider_disclosure)
        .map_err(|error| command_error("Failed to start currency addition", error))?;
    state.spawn_currency_job_drive();
    Ok(job)
}

#[tauri::command]
pub async fn disable_currency(
    code: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<CurrencySettingsRow> {
    state
        .currency_service()
        .disable_currency(&code)
        .map_err(|error| command_error("Failed to disable currency", error))
}

#[tauri::command]
pub async fn start_default_currency_change(
    code: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<CurrencyJob> {
    let job = state
        .currency_service()
        .start_default_currency_change(&code)
        .map_err(|error| command_error("Failed to start default-currency change", error))?;
    state.spawn_currency_job_drive();
    Ok(job)
}

#[tauri::command]
pub async fn cancel_currency_job(
    job_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<CurrencyJob> {
    state
        .currency_service()
        .cancel_currency_job(&job_id)
        .map_err(|error| command_error("Failed to cancel currency job", error))
}

#[tauri::command]
pub async fn get_transaction_exchange_rate_quote(
    source: String,
    target: String,
    date: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<ExchangeRateQuote> {
    state
        .currency_service()
        .quote(&source, &target, &date)
        .map_err(|error| command_error("Failed to load exchange-rate quote", error))
}

#[tauri::command]
pub async fn retry_exchange_rate_refresh(
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<()> {
    state.retry_exchange_rate_refresh().await;
    Ok(())
}
