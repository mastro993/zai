use chrono::{TimeZone, Utc};
use serde_json::{Value, json};
use zai_core::Error;
use zai_core::features::exchange_rates::SyncMetadata;
use zai_core::features::exchange_rates::{
    FailureClass, RefreshOutcome, build_initial_requests, build_refresh_request,
    refresh_failure_public_facts, request_contains_forbidden,
};

const CANARY_DESCRIPTION: &str = "CANARY_DESC_MEMBERSHIP_ZX9";
const CANARY_CATEGORY: &str = "CANARY_CATEGORY_MEMBERSHIP_ZX9";
const CANARY_NOTE: &str = "CANARY_NOTE_ZX9";
const CANARY_AMOUNT: &str = "424242";
const CANARY_TX_ID: &str = "txn-canary-deadbeef";
const CANARY_HISTORY: &str = "2011-03-17";
const CANARY_RATE: &str = "1.0945321";
const CANARY_HTTP: &str = "error sending request for url (https://evil.example/secret)";

fn canaries() -> [&'static str; 7] {
    [
        CANARY_DESCRIPTION,
        CANARY_CATEGORY,
        CANARY_NOTE,
        CANARY_AMOUNT,
        CANARY_TX_ID,
        CANARY_HISTORY,
        CANARY_RATE,
    ]
}

fn assert_absent(surface: &str, haystack: &str) {
    for canary in canaries() {
        assert!(
            !haystack.contains(canary),
            "{surface} leaked {canary}: {haystack}"
        );
    }
}

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

#[test]
fn provider_requests_omit_financial_and_identity_canaries() {
    let now = Utc.with_ymd_and_hms(2026, 8, 18, 12, 0, 0).unwrap();
    for request in build_initial_requests(now) {
        assert!(!request_contains_forbidden(&request, &canaries()));
        assert_eq!(request.host, "data-api.ecb.europa.eu");
        assert!(request.url().starts_with("https://data-api.ecb.europa.eu/"));
        assert!(!request.url().contains("ARS"));
    }
    let refresh = build_refresh_request(&SyncMetadata {
        updated_after: Some("2026-08-17T16:00:00+02:00".to_string()),
        etag: Some("etag-1".to_string()),
    });
    assert!(!request_contains_forbidden(&refresh, &canaries()));
}

#[test]
fn logs_alerts_and_error_envelopes_omit_payloads_and_canaries() {
    let outcome = RefreshOutcome::Failed {
        class: FailureClass::HttpStatus,
        elapsed_ms: 18,
    };
    assert_absent("log", &outcome.log_line());
    assert_eq!(
        outcome.log_line(),
        "provider_refresh class=httpStatus elapsed_ms=18"
    );

    let facts = refresh_failure_public_facts(FailureClass::Transport, 9);
    let serialized = serde_json::to_string(&facts).expect("facts");
    assert_absent("alert facts", &serialized);
    walk_json_strings(&facts, &mut |text| {
        assert_absent("alert fact string", text);
    });
    assert_eq!(facts, json!({ "class": "transport", "elapsedMs": 9 }));

    let envelope = Error::Unexpected(format!("{CANARY_HTTP} {CANARY_RATE} {CANARY_DESCRIPTION}"))
        .to_envelope("Failed to refresh exchange rates");
    let envelope_json = serde_json::to_value(envelope).expect("envelope");
    let serialized = serde_json::to_string(&envelope_json).expect("serialize");
    assert_absent("error envelope", &serialized);
    assert!(!serialized.contains(CANARY_HTTP));
}
