use std::sync::Arc;

use log::debug;
use tauri::State;
use zai_app::ServiceContext;
use zai_core::features::domain_alerts::{DomainAlertListPage, ListDomainAlertsQuery};

use super::{CommandResult, command_error};

#[tauri::command]
pub async fn list_alerts(
    query: Option<ListDomainAlertsQuery>,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<DomainAlertListPage> {
    debug!("Listing domain alerts...");
    state
        .domain_alerts_service()
        .list_alerts(query.unwrap_or_default())
        .await
        .map_err(|error| command_error("Failed to load alerts", error))
}

#[tauri::command]
pub async fn get_unread_alert_count(state: State<'_, Arc<ServiceContext>>) -> CommandResult<i64> {
    debug!("Getting unread alert count...");
    state
        .domain_alerts_service()
        .unread_count()
        .await
        .map_err(|error| command_error("Failed to load unread alert count", error))
}
