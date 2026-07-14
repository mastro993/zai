use super::query::{ListDomainAlertsQuery, MAX_LIST_LIMIT, MIN_LIST_LIMIT};
use crate::Error;
use serde::Deserialize;

#[test]
fn rejects_out_of_range_limits() {
    let below = ListDomainAlertsQuery {
        limit: Some(MIN_LIST_LIMIT - 1),
        ..Default::default()
    };
    let above = ListDomainAlertsQuery {
        limit: Some(MAX_LIST_LIMIT + 1),
        ..Default::default()
    };

    assert!(matches!(
        below.validate().expect_err("below min should fail"),
        Error::InvalidData(_)
    ));
    assert!(matches!(
        above.validate().expect_err("above max should fail"),
        Error::InvalidData(_)
    ));
}

#[test]
fn rejects_empty_severity_filter() {
    let query = ListDomainAlertsQuery {
        severities: Some(vec![]),
        ..Default::default()
    };

    assert!(matches!(
        query.validate().expect_err("empty severities should fail"),
        Error::InvalidData(_)
    ));
}

#[test]
fn rejects_unknown_cursor_versions() {
    let query = ListDomainAlertsQuery {
        cursor: Some("v2|2026-07-14T12:00:00.000000000|6ba7b810-9dad-11d1-80b4-00c04fd430c8".to_string()),
        ..Default::default()
    };

    assert!(matches!(
        query.validate().expect_err("unknown cursor version should fail"),
        Error::InvalidData(_)
    ));
}

#[test]
fn deserializes_transport_query_envelope_in_camel_case() {
    let query: ListDomainAlertsQuery = serde_json::from_value(serde_json::json!({
        "cursor": "v1|2026-07-14T12:00:00.000000000|6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "limit": 25,
        "readState": "unread",
        "severities": ["warning", "critical"]
    }))
    .expect("query should deserialize");

    assert_eq!(query.limit, Some(25));
    assert_eq!(
        query.read_state,
        Some(super::query::DomainAlertReadState::Unread)
    );
    assert_eq!(
        query.severities,
        Some(vec![
            super::models::DomainAlertSeverity::Warning,
            super::models::DomainAlertSeverity::Critical,
        ])
    );
    query.validate().expect("query should validate");
}

#[test]
fn deserializes_severity_query_params_from_url_encoding() {
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct QueryParams {
        #[serde(default, deserialize_with = "super::query::deserialize_optional_severities")]
        severities: Option<Vec<super::models::DomainAlertSeverity>>,
    }

    let query: QueryParams =
        serde_urlencoded::from_str("severities=warning").expect("severity query should decode");
    assert_eq!(
        query.severities,
        Some(vec![super::models::DomainAlertSeverity::Warning])
    );
}
