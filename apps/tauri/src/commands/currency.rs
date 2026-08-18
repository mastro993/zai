use std::sync::Arc;

use serde::Serialize;
use tauri::State;
use zai_app::ServiceContext;
use zai_core::features::currency::CurrencySetupState;

use super::{CommandResult, command_error};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencySetupStateDto {
    pub default_currency: String,
    pub setup_completed: bool,
}

impl From<CurrencySetupState> for CurrencySetupStateDto {
    fn from(value: CurrencySetupState) -> Self {
        Self {
            default_currency: value.default_currency,
            setup_completed: value.setup_completed,
        }
    }
}

#[tauri::command]
pub async fn complete_initial_currency_setup(
    default_currency: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<CurrencySetupStateDto> {
    state
        .currency_service()
        .complete_initial_setup(&default_currency)
        .map(CurrencySetupStateDto::from)
        .map_err(|error| command_error("Failed to complete initial currency setup", error))
}
