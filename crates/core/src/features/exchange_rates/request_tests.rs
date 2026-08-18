use chrono::{TimeZone, Utc};

use super::contract::{APPROVED_ECB_CURRENCIES, ECB_HOST, USER_AGENT};
use super::ports::SyncMetadata;
use super::request::{build_initial_requests, build_refresh_request, request_contains_forbidden};

const CANARY_AMOUNT: &str = "424242";
const CANARY_DESCRIPTION: &str = "CANARY_DESC_MEMBERSHIP_ZX9";
const CANARY_CATEGORY: &str = "CANARY_CATEGORY_MEMBERSHIP_ZX9";
const CANARY_NOTE: &str = "CANARY_NOTE_ZX9";
const CANARY_TX_ID: &str = "txn-canary-deadbeef";
const CANARY_HISTORY_START: &str = "2011-03-17";
const USER_ONLY_CURRENCY: &str = "ARS";

fn now() -> chrono::DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 8, 18, 12, 0, 0).unwrap()
}

fn canaries() -> [&'static str; 6] {
    [
        CANARY_AMOUNT,
        CANARY_DESCRIPTION,
        CANARY_CATEGORY,
        CANARY_NOTE,
        CANARY_TX_ID,
        CANARY_HISTORY_START,
    ]
}

#[test]
fn initial_requests_use_fixed_host_series_and_year_chunks() {
    let requests = build_initial_requests(now());
    assert_eq!(requests.len(), 2026 - 1999 + 1);
    assert_eq!(requests[0].host, ECB_HOST);
    assert!(
        requests[0]
            .path
            .starts_with("/service/data/EXR/D.AUD+BRL+CAD")
    );
    assert!(requests[0].path.ends_with("+USD+ZAR.EUR.SP00.A"));
    assert_eq!(
        requests[0].query,
        vec![
            ("format".to_string(), "csvdata".to_string()),
            ("detail".to_string(), "dataonly".to_string()),
            ("startPeriod".to_string(), "1999-01-04".to_string()),
            ("endPeriod".to_string(), "1999-12-31".to_string()),
        ]
    );
    assert_eq!(
        requests.last().expect("last year").query[2],
        ("startPeriod".to_string(), "2026-01-01".to_string())
    );
    for request in &requests {
        assert_eq!(
            request.headers,
            vec![
                ("User-Agent".to_string(), USER_AGENT.to_string()),
                ("Accept".to_string(), "text/csv".to_string()),
            ]
        );
        assert!(request.url().starts_with("https://data-api.ecb.europa.eu/"));
        assert!(!request.url().contains(USER_ONLY_CURRENCY));
        assert!(!request_contains_forbidden(request, &canaries()));
    }
}

#[test]
fn refresh_request_uses_provider_sync_metadata_only() {
    let request = build_refresh_request(&SyncMetadata {
        updated_after: Some("2026-08-17T16:00:00+02:00".to_string()),
        etag: Some("etag-1".to_string()),
    });
    assert_eq!(request.host, ECB_HOST);
    assert!(
        request
            .query
            .iter()
            .any(|(key, value)| key == "updatedAfter" && value == "2026-08-17T16:00:00+02:00")
    );
    assert!(
        request
            .url()
            .contains("updatedAfter=2026-08-17T16%3A00%3A00%2B02%3A00")
    );
    assert!(
        request
            .headers
            .iter()
            .any(|(name, value)| name == "If-None-Match" && value == "etag-1")
    );
    assert!(!request_contains_forbidden(&request, &canaries()));
    assert!(!request.url().contains(USER_ONLY_CURRENCY));
}

#[test]
fn approved_set_is_fixed_and_excludes_rub() {
    assert_eq!(APPROVED_ECB_CURRENCIES.len(), 29);
    assert!(!APPROVED_ECB_CURRENCIES.contains(&"RUB"));
    assert!(!APPROVED_ECB_CURRENCIES.contains(&"EUR"));
    assert!(USER_AGENT.starts_with("Zai/"));
    assert!(!USER_AGENT.contains(CANARY_TX_ID));
}
