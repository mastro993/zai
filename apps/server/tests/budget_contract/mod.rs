use std::sync::Arc;

use axum::http::StatusCode;
use serde_json::{Value, json};
use zai_app::ServiceContext;
use zai_core::Error;
use zai_core::features::budgets::models::{
    BudgetLifecycleUpdate, BudgetListFilter, BudgetUpdate, NewBudget,
};

use crate::common::{TempAppDataDir, request_json};

pub struct ContractHarness {
    pub context: Arc<ServiceContext>,
    pub router: axum::Router,
    pub _dir: TempAppDataDir,
}

pub async fn setup_contract(prefix: &str) -> ContractHarness {
    let (router, context, dir) = crate::common::setup_app(prefix).await;
    ContractHarness {
        context,
        router,
        _dir: dir,
    }
}

pub struct HttpCall {
    pub method: &'static str,
    pub path: String,
    pub body: Option<Value>,
    pub expected_status: StatusCode,
}

pub struct ContractExpectation {
    pub http: HttpCall,
    pub compare_body: bool,
    pub expected_error_code: Option<&'static str>,
}

fn budget_payload(name: &str) -> Value {
    json!({
        "name": name,
        "baseAllowance": 10000
    })
}

fn normalize_success(value: &mut Value) {
    let Some(object) = value.as_object_mut() else {
        return;
    };
    object.remove("createdAt");
    object.remove("updatedAt");
    object.remove("id");
    if let Some(period) = object.get_mut("currentPeriod").and_then(Value::as_object_mut) {
        period.remove("start");
        period.remove("end");
    }
}

fn normalize_budget_list(value: &mut Value) {
    let Some(items) = value.as_array_mut() else {
        return;
    };
    for item in &mut *items {
        normalize_success(item);
    }
    items.sort_by(|left, right| {
        left["name"]
            .as_str()
            .unwrap_or_default()
            .cmp(right["name"].as_str().unwrap_or_default())
    });
}

fn normalize_history(value: &mut Value) {
    let Some(object) = value.as_object_mut() else {
        return;
    };
    if let Some(rows) = object.get_mut("data").and_then(Value::as_array_mut) {
        for row in rows {
            if let Some(period) = row.as_object_mut() {
                period.remove("start");
                period.remove("end");
            }
        }
    }
}

pub async fn assert_read_parity(harness: &ContractHarness, expectation: ContractExpectation) {
    compare_transports(&harness.router, &harness.context, &expectation).await;
}

pub async fn compare_http_and_tauri(
    http: &ContractHarness,
    tauri: &ContractHarness,
    build_expectation: impl Fn(&str) -> ContractExpectation,
    http_id: &str,
    tauri_id: &str,
) {
    let http_expectation = build_expectation(http_id);
    let tauri_expectation = build_expectation(tauri_id);

    let (http_status, http_body) = request_json(
        &http.router,
        http_expectation.http.method,
        &http_expectation.http.path,
        http_expectation.http.body.clone(),
    )
    .await;
    assert_eq!(
        http_status, http_expectation.http.expected_status,
        "http status mismatch for {} {}: {http_body}",
        http_expectation.http.method, http_expectation.http.path
    );

    let tauri_body = run_tauri_for_http(&tauri.context, &tauri_expectation.http).await;
    compare_bodies(&http_expectation, http_body, tauri_body);
}

async fn compare_transports(
    router: &axum::Router,
    context: &ServiceContext,
    expectation: &ContractExpectation,
) {
    let (http_status, http_body) = request_json(
        router,
        expectation.http.method,
        &expectation.http.path,
        expectation.http.body.clone(),
    )
    .await;
    assert_eq!(
        http_status, expectation.http.expected_status,
        "http status mismatch for {} {}: {http_body}",
        expectation.http.method, expectation.http.path
    );

    let tauri_body = run_tauri_for_http(context, &expectation.http).await;
    compare_bodies(expectation, http_body, tauri_body);
}

fn compare_bodies(
    expectation: &ContractExpectation,
    http_body: Value,
    tauri_body: Value,
) {
    if let Some(code) = expectation.expected_error_code {
        assert_eq!(http_body["code"], code, "http error code");
        assert_eq!(tauri_body["code"], code, "tauri error code");
        if let Some(details) = http_body.get("details") {
            assert_eq!(tauri_body.get("details"), Some(details));
        }
        return;
    }

    if !expectation.compare_body {
        return;
    }

    let mut http_normalized = http_body;
    let mut tauri_normalized = tauri_body;
    if http_normalized.is_array() {
        normalize_budget_list(&mut http_normalized);
        normalize_budget_list(&mut tauri_normalized);
    } else if http_normalized.is_null() {
        assert!(tauri_normalized.is_null() || tauri_normalized == Value::Null);
    } else if http_normalized.get("data").is_some() {
        normalize_history(&mut http_normalized);
        normalize_history(&mut tauri_normalized);
    } else {
        normalize_success(&mut http_normalized);
        normalize_success(&mut tauri_normalized);
    }

    assert_eq!(
        tauri_normalized, http_normalized,
        "transport bodies diverged for {} {}",
        expectation.http.method, expectation.http.path
    );
}

async fn run_tauri_for_http(context: &ServiceContext, call: &HttpCall) -> Value {
    let path_only = call.path.split('?').next().unwrap_or(&call.path);
    match (call.method, path_only) {
        ("GET", "/api/cash-flow/budgets") => {
            let filter = parse_list_filter_from_path(&call.path);
            tauri_success(
                context.budgets_service().list_budgets(filter).await,
                "Failed to load budgets",
            )
        }
        ("GET", path) if path.starts_with("/api/cash-flow/budgets/") && path.ends_with("/history") => {
            let budget_id = extract_budget_id(path, "/history");
            let (page, per_page) = parse_history_query_from_path(&call.path);
            tauri_success(
                context
                    .budgets_service()
                    .get_budget_history(&budget_id, page, per_page)
                    .await,
                "Failed to load budget history",
            )
        }
        ("GET", path) if path.starts_with("/api/cash-flow/budgets/") => {
            let budget_id = extract_budget_id(path, "");
            tauri_success(
                context.budgets_service().get_budget(&budget_id).await,
                "Failed to load budget",
            )
        }
        ("POST", "/api/cash-flow/budgets") => {
            let new_budget: NewBudget =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("budget payload");
            tauri_success(
                context.budgets_service().create_budget(new_budget).await,
                "Failed to create budget",
            )
        }
        ("PUT", path) if path.starts_with("/api/cash-flow/budgets/") => {
            let budget_id = extract_budget_id(path, "");
            let update: BudgetUpdate =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("budget update");
            tauri_success(
                context
                    .budgets_service()
                    .update_budget(&budget_id, update)
                    .await,
                "Failed to update budget",
            )
        }
        ("POST", path) if path.ends_with("/pause") => {
            let budget_id = extract_budget_id(path, "/pause");
            let update = lifecycle_update(call.body.as_ref());
            tauri_success(
                context
                    .budgets_service()
                    .pause_budget(&budget_id, update)
                    .await,
                "Failed to pause budget",
            )
        }
        ("POST", path) if path.ends_with("/resume") => {
            let budget_id = extract_budget_id(path, "/resume");
            let update = lifecycle_update(call.body.as_ref());
            tauri_success(
                context
                    .budgets_service()
                    .resume_budget(&budget_id, update)
                    .await,
                "Failed to resume budget",
            )
        }
        ("DELETE", path) if path.starts_with("/api/cash-flow/budgets/") => {
            let budget_id = extract_budget_id(path, "");
            let update = lifecycle_update(call.body.as_ref());
            match context
                .budgets_service()
                .delete_budget(&budget_id, update)
                .await
            {
                Ok(()) => Value::Null,
                Err(error) => tauri_error("Failed to delete budget", error),
            }
        }
        _ => panic!("unsupported contract call: {} {}", call.method, call.path),
    }
}

fn tauri_success<T: serde::Serialize>(
    result: Result<T, Error>,
    context: &'static str,
) -> Value {
    match result {
        Ok(value) => serde_json::to_value(value).expect("serialize success"),
        Err(error) => tauri_error(context, error),
    }
}

fn tauri_error(context: &'static str, error: Error) -> Value {
    serde_json::to_value(error.to_envelope(context)).expect("serialize error")
}

fn lifecycle_update(body: Option<&Value>) -> BudgetLifecycleUpdate {
    serde_json::from_value(body.cloned().unwrap_or(json!({ "expectedRevision": 0 })))
        .expect("lifecycle update")
}

fn parse_list_filter_from_path(path: &str) -> BudgetListFilter {
    let Some(query) = path.split_once('?').map(|(_, query)| query) else {
        return BudgetListFilter::default();
    };
    for pair in query.split('&') {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        if key == "filter" {
            return serde_json::from_value(json!(value)).unwrap_or_default();
        }
    }
    BudgetListFilter::default()
}

fn parse_history_query_from_path(path: &str) -> (i64, i64) {
    let mut page = 1_i64;
    let mut per_page = 50_i64;
    let Some(query) = path.split_once('?').map(|(_, query)| query) else {
        return (page, per_page);
    };
    for pair in query.split('&') {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        match key {
            "page" => page = value.parse().unwrap_or(page),
            "perPage" => per_page = value.parse().unwrap_or(per_page),
            _ => {}
        }
    }
    (page, per_page)
}

fn extract_budget_id(path: &str, suffix: &str) -> String {
    let trimmed = path.trim_start_matches("/api/cash-flow/budgets/");
    trimmed
        .strip_suffix(suffix)
        .unwrap_or(trimmed)
        .to_string()
}

pub async fn seed_budget(harness: &ContractHarness, name: &str) -> (StatusCode, Value) {
    request_json(
        &harness.router,
        "POST",
        "/api/cash-flow/budgets",
        Some(budget_payload(name)),
    )
    .await
}

pub fn create_success(name: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/cash-flow/budgets".to_string(),
            body: Some(budget_payload(name)),
            expected_status: StatusCode::CREATED,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn list_active_success() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/cash-flow/budgets".to_string(),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn detail_success(budget_id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: format!("/api/cash-flow/budgets/{budget_id}"),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn history_success(budget_id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: format!("/api/cash-flow/budgets/{budget_id}/history"),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn name_conflict_error() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/cash-flow/budgets".to_string(),
            body: Some(budget_payload(" monthly ")),
            expected_status: StatusCode::CONFLICT,
        },
        compare_body: false,
        expected_error_code: Some("nameConflict"),
    }
}

pub fn revision_conflict_update(budget_id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "PUT",
            path: format!("/api/cash-flow/budgets/{budget_id}"),
            body: Some(json!({
                "expectedRevision": 0,
                "name": "Stale",
                "baseAllowance": 30000,
                "cadence": "month",
                "categoryIds": [],
                "measurementMode": "spending",
                "rolloverMode": "off",
                "warningPercentage": 80
            })),
            expected_status: StatusCode::CONFLICT,
        },
        compare_body: false,
        expected_error_code: Some("revisionConflict"),
    }
}

pub fn cadence_validation_error(budget_id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "PUT",
            path: format!("/api/cash-flow/budgets/{budget_id}"),
            body: Some(json!({
                "expectedRevision": 0,
                "name": "Monthly",
                "baseAllowance": 10000,
                "cadence": "week",
                "categoryIds": [],
                "measurementMode": "spending",
                "rolloverMode": "off",
                "warningPercentage": 80
            })),
            expected_status: StatusCode::BAD_REQUEST,
        },
        compare_body: false,
        expected_error_code: Some("validation"),
    }
}

pub fn history_validation_error(budget_id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: format!("/api/cash-flow/budgets/{budget_id}/history?perPage=101"),
            body: None,
            expected_status: StatusCode::BAD_REQUEST,
        },
        compare_body: false,
        expected_error_code: Some("validation"),
    }
}

pub fn not_found_detail(budget_id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: format!("/api/cash-flow/budgets/{budget_id}"),
            body: None,
            expected_status: StatusCode::NOT_FOUND,
        },
        compare_body: false,
        expected_error_code: Some("notFound"),
    }
}

pub fn delete_no_content(budget_id: &str, revision: i64) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "DELETE",
            path: format!("/api/cash-flow/budgets/{budget_id}"),
            body: Some(json!({ "expectedRevision": revision })),
            expected_status: StatusCode::NO_CONTENT,
        },
        compare_body: false,
        expected_error_code: None,
    }
}

pub fn pause_success(budget_id: &str, revision: i64) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: format!("/api/cash-flow/budgets/{budget_id}/pause"),
            body: Some(json!({ "expectedRevision": revision })),
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn resume_success(budget_id: &str, revision: i64) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: format!("/api/cash-flow/budgets/{budget_id}/resume"),
            body: Some(json!({ "expectedRevision": revision })),
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn update_success(budget_id: &str, revision: i64) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "PUT",
            path: format!("/api/cash-flow/budgets/{budget_id}"),
            body: Some(json!({
                "expectedRevision": revision,
                "name": "Updated monthly",
                "baseAllowance": 20000,
                "cadence": "month",
                "categoryIds": [],
                "measurementMode": "spending",
                "rolloverMode": "off",
                "warningPercentage": 80
            })),
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub async fn request_update(
    harness: &ContractHarness,
    budget_id: &str,
    revision: i64,
) -> (StatusCode, Value) {
    request_json(
        &harness.router,
        "PUT",
        &format!("/api/cash-flow/budgets/{budget_id}"),
        Some(json!({
            "expectedRevision": revision,
            "name": "Updated monthly",
            "baseAllowance": 20000,
            "cadence": "month",
            "categoryIds": [],
            "measurementMode": "spending",
            "rolloverMode": "off",
            "warningPercentage": 80
        })),
    )
    .await
}

pub async fn request_pause(
    harness: &ContractHarness,
    budget_id: &str,
    revision: i64,
) -> (StatusCode, Value) {
    request_json(
        &harness.router,
        "POST",
        &format!("/api/cash-flow/budgets/{budget_id}/pause"),
        Some(json!({ "expectedRevision": revision })),
    )
    .await
}

pub async fn request_resume(
    harness: &ContractHarness,
    budget_id: &str,
    revision: i64,
) -> (StatusCode, Value) {
    request_json(
        &harness.router,
        "POST",
        &format!("/api/cash-flow/budgets/{budget_id}/resume"),
        Some(json!({ "expectedRevision": revision })),
    )
    .await
}

pub async fn request_delete(
    harness: &ContractHarness,
    budget_id: &str,
    revision: i64,
) -> (StatusCode, Value) {
    request_json(
        &harness.router,
        "DELETE",
        &format!("/api/cash-flow/budgets/{budget_id}"),
        Some(json!({ "expectedRevision": revision })),
    )
    .await
}

