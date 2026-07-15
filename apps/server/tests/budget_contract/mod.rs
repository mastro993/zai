use axum::http::StatusCode;
use serde_json::{Value, json};

use crate::common::request_json;

pub use crate::contract_harness::{ContractExpectation, ContractHarness, HttpCall};
pub use crate::contract_harness::{assert_read_parity, compare_http_and_tauri, setup_contract};

fn budget_payload(name: &str) -> Value {
    json!({
        "name": name,
        "baseAllowance": 10000
    })
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
