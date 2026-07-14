use std::sync::Arc;

use log::debug;
use tauri::State;
use zai_app::ServiceContext;
use zai_core::features::domain_alerts::{DomainAlert, DomainAlertListPage, ListDomainAlertsQuery};

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

#[tauri::command]
pub async fn mark_all_alerts_read(state: State<'_, Arc<ServiceContext>>) -> CommandResult<i64> {
    debug!("Marking all domain alerts read...");
    state
        .domain_alerts_service()
        .mark_all_read()
        .await
        .map_err(|error| command_error("Failed to mark all alerts read", error))
}

#[tauri::command]
pub async fn mark_alert_read(
    alert_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<DomainAlert> {
    debug!("Marking domain alert read...");
    state
        .domain_alerts_service()
        .mark_read(&alert_id)
        .await
        .map_err(|error| command_error("Failed to mark alert read", error))
}

#[tauri::command]
pub async fn mark_alert_unread(
    alert_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<DomainAlert> {
    debug!("Marking domain alert unread...");
    state
        .domain_alerts_service()
        .mark_unread(&alert_id)
        .await
        .map_err(|error| command_error("Failed to mark alert unread", error))
}
