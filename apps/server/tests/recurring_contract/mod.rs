#![allow(dead_code, unused_imports)]

use axum::http::StatusCode;
use serde_json::{Value, json};

use crate::common::request_json;

pub use crate::contract_harness::{ContractExpectation, ContractHarness, HttpCall};
pub use crate::contract_harness::{assert_read_parity, compare_http_and_tauri, setup_contract};

pub const CONTRACT_RECURRING_ID: &str = "rt-contract-1";

pub fn recurring_create_payload(id: &str) -> Value {
    json!({
        "id": id,
        "schedule": { "type": "interval", "every": 1, "unit": "month" },
        "firstScheduledLocal": "2026-08-01T09:00:00",
        "totalOccurrences": 12,
        "template": {
            "description": "Membership",
            "amount": 4500,
            "transactionType": "expense",
            "transactionCategoryId": null,
            "notes": null
        }
    })
}

pub async fn seed_recurring(harness: &ContractHarness, id: &str) -> (StatusCode, Value) {
    request_json(
        &harness.router,
        "POST",
        "/api/cash-flow/recurring-transactions",
        Some(recurring_create_payload(id)),
    )
    .await
}

pub fn create_success(id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/cash-flow/recurring-transactions".to_string(),
            body: Some(recurring_create_payload(id)),
            expected_status: StatusCode::CREATED,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn feed_success() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/cash-flow/recurring-transactions".to_string(),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn detail_success(id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: format!("/api/cash-flow/recurring-transactions/{id}"),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn feed_cursor_validation_error() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/cash-flow/recurring-transactions?cursor=not-a-cursor".to_string(),
            body: None,
            expected_status: StatusCode::BAD_REQUEST,
        },
        compare_body: false,
        expected_error_code: Some("validation"),
    }
}

pub fn pause_success(id: &str, revision: i64) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: format!("/api/cash-flow/recurring-transactions/{id}/pause"),
            body: Some(json!({ "expectedRevision": revision })),
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn provenance_success(transaction_id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: format!("/api/cash-flow/recurring-transactions/provenance/{transaction_id}"),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn projection_success() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/cash-flow/recurring-transactions/budget-projections?horizonMonths=3"
                .to_string(),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn bulk_preflight_success(id: &str, revision: i64) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/cash-flow/recurring-transactions/bulk/preflight".to_string(),
            body: Some(json!({
                "action": "pause",
                "items": [{
                    "recurringTransactionId": id,
                    "expectedRevision": revision
                }]
            })),
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn processing_status_success() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/cash-flow/recurring-processing/status".to_string(),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn not_found_detail(id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: format!("/api/cash-flow/recurring-transactions/{id}"),
            body: None,
            expected_status: StatusCode::NOT_FOUND,
        },
        compare_body: false,
        expected_error_code: Some("notFound"),
    }
}

pub fn create_validation_error() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/cash-flow/recurring-transactions".to_string(),
            body: Some(json!({
                "id": "rt-invalid",
                "schedule": { "type": "interval", "every": 0, "unit": "month" },
                "firstScheduledLocal": "2026-08-01T09:00:00",
                "totalOccurrences": 12,
                "template": {
                    "description": "Bad",
                    "amount": 100,
                    "transactionType": "expense",
                    "transactionCategoryId": null,
                    "notes": null
                }
            })),
            expected_status: StatusCode::BAD_REQUEST,
        },
        compare_body: false,
        expected_error_code: Some("validation"),
    }
}

pub fn resume_success(id: &str, revision: i64) -> ContractExpectation {
    lifecycle_success(id, "resume", revision)
}

pub fn stop_success(id: &str, revision: i64) -> ContractExpectation {
    lifecycle_success(id, "stop", revision)
}

pub fn delete_success(id: &str, revision: i64) -> ContractExpectation {
    lifecycle_success(id, "delete", revision)
}

fn lifecycle_success(id: &str, action: &str, revision: i64) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: format!("/api/cash-flow/recurring-transactions/{id}/{action}"),
            body: Some(json!({ "expectedRevision": revision })),
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn update_success(id: &str, revision: i64) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: format!("/api/cash-flow/recurring-transactions/{id}"),
            body: Some(json!({
                "recurringTransactionId": id,
                "expectedRevision": revision,
                "schedule": { "type": "interval", "every": 1, "unit": "month" },
                "nextScheduledLocal": "2026-09-01T09:00:00",
                "totalOccurrences": 12,
                "template": {
                    "description": "Membership",
                    "amount": 4600,
                    "transactionType": "expense",
                    "transactionCategoryId": null,
                    "notes": null
                }
            })),
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn adoption_preview_success(transaction_id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/cash-flow/recurring-transactions/adoption-preview".to_string(),
            body: Some(json!({
                "transactionId": transaction_id,
                "schedule": { "type": "interval", "every": 1, "unit": "month" },
                "totalOccurrences": 6
            })),
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn adopt_success(id: &str, transaction_id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/cash-flow/recurring-transactions/adopt".to_string(),
            body: Some(json!({
                "id": id,
                "transactionId": transaction_id,
                "schedule": { "type": "interval", "every": 1, "unit": "month" },
                "totalOccurrences": 6,
                "template": {
                    "description": "Adopted membership",
                    "amount": 1500,
                    "transactionType": "expense",
                    "transactionCategoryId": null,
                    "notes": null
                }
            })),
            expected_status: StatusCode::CREATED,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn failure_history_success(id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: format!("/api/cash-flow/recurring-transactions/{id}/failures"),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn retry_without_failure_unchanged(id: &str, revision: i64) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: format!("/api/cash-flow/recurring-transactions/{id}/retry"),
            body: Some(json!({ "expectedRevision": revision })),
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn repair_preview_without_failure_error(id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: format!("/api/cash-flow/recurring-transactions/{id}/repair/preview"),
            body: Some(json!({
                "recurringTransactionId": id,
                "repairFieldKey": "transactionCategoryId",
                "template": {
                    "description": "Membership",
                    "amount": 4500,
                    "transactionType": "expense",
                    "transactionCategoryId": null,
                    "notes": null
                }
            })),
            expected_status: StatusCode::BAD_REQUEST,
        },
        compare_body: false,
        expected_error_code: Some("validation"),
    }
}

pub fn bulk_execute_success(id: &str, revision: i64) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/cash-flow/recurring-transactions/bulk/execute".to_string(),
            body: Some(json!({
                "action": "pause",
                "items": [{
                    "recurringTransactionId": id,
                    "expectedRevision": revision
                }]
            })),
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

pub fn attribution_projection_success(id: &str) -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: format!(
                "/api/cash-flow/recurring-transactions/budget-projections?horizonMonths=3&focusRecurringTransactionId={id}"
            ),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}
