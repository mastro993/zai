use std::collections::BTreeSet;
use std::path::PathBuf;

use chrono::NaiveDate;
use serde_json::{Value, json};
use zai_core::DatabaseError;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    GenerationFailureDiagnostics, RecurringProcessingEvent, RecurringProcessingFinishState,
    build_process_delay_alert, serialize_recurring_processing_event,
};

mod common;
mod contract_harness;
mod recurring_contract;

use crate::common::request_json;
use crate::contract_harness::{assert_read_parity, run_tauri_for_http};
use axum::http::StatusCode;
use recurring_contract::{CONTRACT_RECURRING_ID, bulk_preflight_success, setup_contract};

const CANARY_DESCRIPTION: &str = "CANARY_DESC_MEMBERSHIP_ZX9";
const CANARY_AMOUNT: i32 = 424_242;
const CANARY_SQL: &str = "SENTINEL_SQL_SELECT * FROM recurring_secrets";
const CANARY_STACK: &str = "SENTINEL_STACK at recurring::internal::leak";
const CANARY_INTERNAL_ID: &str = "internal-zone-executor-deadbeef";

fn walk_json_strings(value: &Value, visit: &mut dyn FnMut(&str)) {
    match value {
        Value::String(text) => visit(text),
        Value::Array(items) => {
            for item in items {
                walk_json_strings(item, visit);
            }
        }
        Value::Object(map) => {
            for child in map.values() {
                walk_json_strings(child, visit);
            }
        }
        _ => {}
    }
}

fn assert_absent(surface: &str, value: &Value, canaries: &[&str]) {
    let serialized = serde_json::to_string(value).expect("serialize");
    for canary in canaries {
        assert!(
            !serialized.contains(canary),
            "{surface} leaked canary {canary}: {serialized}"
        );
    }
    walk_json_strings(value, &mut |text| {
        for canary in canaries {
            assert!(
                !text.contains(canary),
                "{surface} leaked canary {canary} in string {text}"
            );
        }
    });
}

#[test]
fn diagnostics_and_events_omit_financial_and_internal_canaries() {
    let diagnostics = GenerationFailureDiagnostics {
        error_code: "invalid_category".into(),
        app_version: "1.0.0".into(),
        schema_version: "9".into(),
        first_failed_at: NaiveDate::from_ymd_opt(2026, 7, 1)
            .unwrap()
            .and_hms_opt(9, 0, 0)
            .unwrap(),
        last_failed_at: NaiveDate::from_ymd_opt(2026, 7, 2)
            .unwrap()
            .and_hms_opt(9, 0, 0)
            .unwrap(),
        typed_state: "open".into(),
        correlation_id: "corr-1".into(),
    };
    let diagnostics_json = serde_json::to_value(&diagnostics).expect("diagnostics");
    assert_absent(
        "diagnostics",
        &diagnostics_json,
        &[
            CANARY_DESCRIPTION,
            &CANARY_AMOUNT.to_string(),
            CANARY_SQL,
            CANARY_STACK,
            CANARY_INTERNAL_ID,
        ],
    );
    let diagnostic_keys = diagnostics_json
        .as_object()
        .expect("object")
        .keys()
        .cloned()
        .collect::<BTreeSet<_>>();
    for forbidden in ["description", "amount", "account", "category", "name"] {
        assert!(
            !diagnostic_keys
                .iter()
                .any(|key| key.to_ascii_lowercase().contains(forbidden)),
            "diagnostics key leaked {forbidden}"
        );
    }

    for event in [
        RecurringProcessingEvent::StateChanged,
        RecurringProcessingEvent::Started {
            run_id: "run-1".into(),
        },
        RecurringProcessingEvent::Progress {
            run_id: "run-1".into(),
            committed: 1,
            already_fulfilled: 0,
            more_due_remaining: false,
        },
        RecurringProcessingEvent::Finished {
            run_id: "run-1".into(),
            committed: 1,
            already_fulfilled: 0,
            more_due_remaining: false,
            state: RecurringProcessingFinishState::CaughtUp,
        },
    ] {
        let payload = serialize_recurring_processing_event(&event).expect("serialize");
        let json: Value = serde_json::from_str(&payload).expect("json");
        assert_absent(
            "processing event",
            &json,
            &[
                CANARY_DESCRIPTION,
                &CANARY_AMOUNT.to_string(),
                CANARY_SQL,
                CANARY_STACK,
                CANARY_INTERNAL_ID,
            ],
        );
        let keys = json
            .as_object()
            .expect("object")
            .keys()
            .cloned()
            .collect::<BTreeSet<_>>();
        for key in &keys {
            let lower = key.to_ascii_lowercase();
            assert!(!lower.contains("description"));
            assert!(!lower.contains("amount"));
            assert!(!lower.contains("account"));
            assert!(!lower.contains("category"));
        }
        assert!(keys.contains("version"));
        assert!(keys.contains("type"));
    }
}

#[test]
fn process_delay_alert_and_public_errors_redact_canaries() {
    let alert = build_process_delay_alert().expect("alert");
    let alert_json = json!({
        "producerKey": alert.producer_key,
        "occurrenceKey": alert.occurrence_key,
        "severity": alert.severity,
        "title": alert.title,
        "body": alert.body,
        "destination": alert.destination,
        "data": alert.data,
    });
    assert_absent(
        "process delay alert",
        &alert_json,
        &[
            CANARY_DESCRIPTION,
            &CANARY_AMOUNT.to_string(),
            CANARY_SQL,
            CANARY_STACK,
            CANARY_INTERNAL_ID,
        ],
    );

    let envelope = Error::Database(DatabaseError::QueryFailed(format!(
        "{CANARY_SQL} {CANARY_STACK} {CANARY_INTERNAL_ID}"
    )))
    .to_envelope("Failed to load recurring transaction");
    let envelope_json = serde_json::to_value(envelope).expect("envelope");
    assert_absent(
        "public ApiError",
        &envelope_json,
        &[CANARY_SQL, CANARY_STACK, CANARY_INTERNAL_ID],
    );
}

#[tokio::test]
async fn bulk_preflight_feedback_omits_template_description_and_amount() {
    let harness = setup_contract("recurring-privacy-bulk").await;
    let payload = json!({
        "id": CONTRACT_RECURRING_ID,
        "schedule": { "type": "interval", "every": 1, "unit": "month" },
        "firstScheduledLocal": "2026-08-01T09:00:00",
        "totalOccurrences": 12,
        "template": {
            "description": CANARY_DESCRIPTION,
            "amount": CANARY_AMOUNT,
            "transactionType": "expense",
            "transactionCategoryId": null,
            "notes": null
        }
    });
    let (status, _) = request_json(
        &harness.router,
        "POST",
        "/api/cash-flow/recurring-transactions",
        Some(payload),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    assert_read_parity(&harness, bulk_preflight_success(CONTRACT_RECURRING_ID, 1)).await;

    let expectation = bulk_preflight_success(CONTRACT_RECURRING_ID, 1);
    let (_, http_body) = request_json(
        &harness.router,
        expectation.http.method,
        &expectation.http.path,
        expectation.http.body.clone(),
    )
    .await;
    let tauri_body = run_tauri_for_http(&harness.context, &expectation.http).await;
    for body in [&http_body, &tauri_body] {
        assert_absent(
            "bulk preflight",
            body,
            &[CANARY_DESCRIPTION, &CANARY_AMOUNT.to_string()],
        );
    }
}

#[test]
fn public_inventory_keeps_process_due_as_internal_port_only() {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let workspace = manifest
        .parent()
        .and_then(|path| path.parent())
        .expect("workspace");

    let tauri_lib = std::fs::read_to_string(workspace.join("apps/tauri/src/lib.rs")).expect("lib");
    let tauri_commands = std::fs::read_to_string(
        workspace.join("apps/tauri/src/commands/recurring_transactions.rs"),
    )
    .expect("commands");
    let server_api = std::fs::read_to_string(
        workspace.join("apps/server/src/api/cash_flow/recurring_transactions.rs"),
    )
    .expect("api");
    let events_api = std::fs::read_to_string(
        workspace.join("apps/server/src/api/cash_flow/recurring_processing_events.rs"),
    )
    .expect("events api");
    let bulk_api =
        std::fs::read_to_string(workspace.join("apps/server/src/api/cash_flow/recurring_bulk.rs"))
            .expect("bulk api");
    let traits = std::fs::read_to_string(
        workspace.join("crates/core/src/features/recurring_transactions/traits.rs"),
    )
    .expect("traits");

    for (label, source) in [
        ("tauri lib", tauri_lib.as_str()),
        ("tauri commands", tauri_commands.as_str()),
        ("recurring api", server_api.as_str()),
        ("processing api", events_api.as_str()),
        ("bulk api", bulk_api.as_str()),
    ] {
        assert!(
            !source.contains("process_due")
                && !source.contains("process-due")
                && !source.contains("processDue"),
            "{label} exposes process_due"
        );
    }

    assert!(
        traits.contains("async fn process_due("),
        "internal RecurringOccurrenceProcessor::process_due port must remain"
    );
    assert!(
        traits.contains("Not exposed through Tauri IPC or public Axum REST endpoints"),
        "process_due must stay documented as internal"
    );
}

#[tokio::test]
async fn seeded_source_surfaces_omit_canaries_from_status_errors_history_and_alerts() {
    let harness = setup_contract("recurring-privacy-seeded").await;
    let (status, category) =
        crate::contract_harness::seed_category(&harness, "CANARY_CAT_ZX9").await;
    assert_eq!(status, StatusCode::CREATED);
    let category_id = category["id"].as_str().expect("category id").to_string();

    let payload = json!({
        "id": "rt-privacy-seed",
        "schedule": { "type": "interval", "every": 1, "unit": "month" },
        "firstScheduledLocal": "2026-08-01T09:00:00",
        "totalOccurrences": 12,
        "template": {
            "description": CANARY_DESCRIPTION,
            "amount": CANARY_AMOUNT,
            "transactionType": "expense",
            "transactionCategoryId": category_id,
            "notes": "CANARY_NOTE_ZX9"
        }
    });
    let (status, _) = request_json(
        &harness.router,
        "POST",
        "/api/cash-flow/recurring-transactions",
        Some(payload),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    let canaries = [
        CANARY_DESCRIPTION,
        &CANARY_AMOUNT.to_string(),
        "CANARY_CAT_ZX9",
        "CANARY_NOTE_ZX9",
        CANARY_SQL,
        CANARY_STACK,
        CANARY_INTERNAL_ID,
    ];

    for (method, path, body) in [
        (
            "GET",
            "/api/cash-flow/recurring-processing/status".to_string(),
            None,
        ),
        (
            "GET",
            "/api/cash-flow/recurring-transactions/rt-privacy-seed/failures".to_string(),
            None,
        ),
        (
            "GET",
            "/api/cash-flow/recurring-transactions/rt-privacy-seed/diagnostics".to_string(),
            None,
        ),
        ("GET", "/api/alerts".to_string(), None),
        (
            "POST",
            "/api/cash-flow/recurring-transactions/bulk/execute".to_string(),
            Some(json!({
                "action": "pause",
                "items": [{ "recurringTransactionId": "rt-privacy-seed", "expectedRevision": 1 }]
            })),
        ),
    ] {
        let (status, http_body) = request_json(&harness.router, method, &path, body.clone()).await;
        assert!(
            status.is_success() || status.is_client_error(),
            "unexpected status {status} for {method} {path}: {http_body}"
        );
        let call = crate::contract_harness::HttpCall {
            method,
            path: path.clone(),
            body,
            expected_status: status,
        };
        let tauri_body = run_tauri_for_http(&harness.context, &call).await;
        for (label, body) in [("http", &http_body), ("tauri", &tauri_body)] {
            assert_absent(&format!("{label} {method} {path}"), body, &canaries);
        }
    }

    let (status, retry_http) = request_json(
        &harness.router,
        "POST",
        "/api/cash-flow/recurring-transactions/rt-privacy-seed/retry",
        Some(json!({ "expectedRevision": 2 })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let retry_call = crate::contract_harness::HttpCall {
        method: "POST",
        path: "/api/cash-flow/recurring-transactions/rt-privacy-seed/retry".to_string(),
        body: Some(json!({ "expectedRevision": 2 })),
        expected_status: StatusCode::OK,
    };
    let retry_tauri = run_tauri_for_http(&harness.context, &retry_call).await;
    for (label, body) in [("http", &retry_http), ("tauri", &retry_tauri)] {
        assert_eq!(body["outcome"], "unchanged", "{label} retry outcome");
        assert_eq!(body["reason"], "no_open_failure", "{label} retry reason");
        let feedback = json!({
            "outcome": body["outcome"].clone(),
            "reason": body["reason"].clone(),
        });
        assert_absent(&format!("{label} retry feedback"), &feedback, &canaries);
    }
}
