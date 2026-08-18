use serde_json::Value;
use zai_app::ServiceContext;

use super::HttpCall;
use super::helpers::{extract_suffix_id, tauri_success};

pub fn try_run_tauri_for_currency(context: &ServiceContext, call: &HttpCall) -> Option<Value> {
    let path_only = call.path.split('?').next().unwrap_or(&call.path);
    let value = match (call.method, path_only) {
        ("GET", "/api/currencies/bootstrap") => tauri_success(
            context.currency_service().bootstrap(),
            "Failed to load currency bootstrap",
        ),
        ("GET", "/api/currencies/catalog") => {
            serde_json::to_value(context.currency_service().supported_catalog())
                .expect("serialize catalog")
        }
        ("GET", "/api/currencies/status") => tauri_success(
            context.currency_service().status(),
            "Failed to load currency status",
        ),
        ("GET", "/api/currencies") => tauri_success(
            context.currency_service().list_settings(),
            "Failed to load currencies",
        ),
        ("GET", path) if path.starts_with("/api/currencies/jobs/") => {
            let job_id = extract_suffix_id(path, "/api/currencies/jobs/", "");
            tauri_success(
                context.currency_service().get_job(&job_id),
                "Failed to load currency job",
            )
        }
        ("GET", path) if path.starts_with("/api/currencies/") => {
            let code = extract_suffix_id(path, "/api/currencies/", "");
            tauri_success(
                context.currency_service().get_currency(&code),
                "Failed to load currency",
            )
        }
        ("POST", "/api/currencies/setup") => {
            let code = call
                .body
                .as_ref()
                .and_then(|body| body["defaultCurrency"].as_str())
                .unwrap_or("")
                .to_string();
            tauri_success(
                context.currency_service().start_initial_setup(&code),
                "Failed to complete initial currency setup",
            )
        }
        _ => return None,
    };
    Some(value)
}
