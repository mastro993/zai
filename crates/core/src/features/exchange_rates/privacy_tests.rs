use crate::Error;
use crate::features::exchange_rates::{FailureClass, RefreshOutcome, refresh_failure_public_facts};

const CANARY_AMOUNT: &str = "424242";
const CANARY_DESCRIPTION: &str = "CANARY_DESC_MEMBERSHIP_ZX9";
const CANARY_CATEGORY: &str = "CANARY_CATEGORY_MEMBERSHIP_ZX9";
const CANARY_NOTE: &str = "CANARY_NOTE_ZX9";
const CANARY_ID: &str = "txn-canary-deadbeef";
const CANARY_BODY: &str = "EXR.D.USD.EUR.SP00.A,1.0945";
const CANARY_HTTP: &str = "error sending request for url (https://data-api.ecb.europa.eu/secret)";

fn canaries() -> [&'static str; 6] {
    [
        CANARY_AMOUNT,
        CANARY_DESCRIPTION,
        CANARY_CATEGORY,
        CANARY_NOTE,
        CANARY_ID,
        CANARY_BODY,
    ]
}

fn assert_absent(surface: &str, haystack: &str) {
    for canary in canaries() {
        assert!(
            !haystack.contains(canary),
            "{surface} leaked {canary}: {haystack}"
        );
    }
    assert!(!haystack.contains(CANARY_HTTP));
}

#[test]
fn failure_facts_and_logs_omit_payloads_and_financial_canaries() {
    let facts = refresh_failure_public_facts(FailureClass::Transport, 12);
    let serialized = serde_json::to_string(&facts).expect("json");
    assert_eq!(serialized, r#"{"class":"transport","elapsedMs":12}"#);
    assert_absent("facts", &serialized);

    let outcome = RefreshOutcome::Failed {
        class: FailureClass::Validation,
        elapsed_ms: 40,
    };
    assert_eq!(
        outcome.log_line(),
        "provider_refresh class=validation elapsed_ms=40"
    );
    assert_absent("log", &outcome.log_line());
}

#[test]
fn public_error_envelope_redacts_raw_http() {
    let envelope = Error::Unexpected(CANARY_HTTP.to_string()).to_envelope("Refresh failed");
    let serialized = serde_json::to_string(&envelope).expect("json");
    assert_absent("envelope", &serialized);
    assert!(serialized.contains("An internal error occurred"));
}
