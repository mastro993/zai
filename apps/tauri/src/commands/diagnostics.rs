use std::{path::Path, sync::Arc};

use tauri::{AppHandle, Manager, Runtime, State};
use zai_app::{DiagnosticsReport, ServiceContext};
use zai_core::{ErrorCode, ErrorEnvelope};

use super::CommandResult;

const OPEN_DATABASE_ERROR: &str = "Database location could not be opened";
const OPEN_LOGS_ERROR: &str = "Logs location could not be opened";

#[tauri::command]
pub async fn get_diagnostics<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<ServiceContext>>,
) -> CommandResult<DiagnosticsReport> {
    let log_dir = app.path().app_log_dir().ok();
    Ok(state.diagnostics(log_dir.as_deref()))
}

#[tauri::command]
pub async fn show_database_in_folder(state: State<'_, Arc<ServiceContext>>) -> CommandResult<()> {
    let path = std::fs::canonicalize(state.database_path())
        .unwrap_or_else(|_| state.database_path().to_path_buf());
    reveal_file_or_open_parent(&path)
        .map_err(|()| ErrorEnvelope::new(ErrorCode::Internal, OPEN_DATABASE_ERROR))
}

#[tauri::command]
pub async fn show_logs_in_folder<R: Runtime>(app: AppHandle<R>) -> CommandResult<()> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|_| ErrorEnvelope::new(ErrorCode::Internal, OPEN_LOGS_ERROR))?;
    let active_log = log_dir.join(format!("{}.log", app.package_info().name));

    if active_log.is_file() && reveal_file_or_open_parent(&active_log).is_ok() {
        return Ok(());
    }

    open_folder(&log_dir).map_err(|()| ErrorEnvelope::new(ErrorCode::Internal, OPEN_LOGS_ERROR))
}

fn reveal_file_or_open_parent(path: &Path) -> Result<(), ()> {
    if path.is_file() && tauri_plugin_opener::reveal_item_in_dir(path).is_ok() {
        return Ok(());
    }

    open_folder(path.parent().ok_or(())?)
}

fn open_folder(path: &Path) -> Result<(), ()> {
    if !path.is_dir() {
        return Err(());
    }

    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|_| ())
}
