use super::models::{
    DomainAlert, DomainAlertDestination, DomainAlertRichData, DomainAlertSeverity,
    MAX_RICH_DATA_BYTES, NewDomainAlert, is_valid_uuid,
};
use crate::Error;

#[test]
fn severity_parses_closed_values() {
    for (value, expected) in [
        ("info", DomainAlertSeverity::Info),
        ("warning", DomainAlertSeverity::Warning),
        ("critical", DomainAlertSeverity::Critical),
    ] {
        assert_eq!(value.parse::<DomainAlertSeverity>().ok(), Some(expected));
    }
    assert!("success".parse::<DomainAlertSeverity>().is_err());
}

#[test]
fn new_domain_alert_accepts_valid_budget_destination() {
    let alert = NewDomainAlert {
        id: Some("550e8400-e29b-41d4-a716-446655440000".to_string()),
        producer_key: "budget.status".to_string(),
        occurrence_key: "period-1".to_string(),
        severity: DomainAlertSeverity::Warning,
        title: "Budget warning".to_string(),
        body: "Spending exceeded 80% of allowance.".to_string(),
        destination: Some(DomainAlertDestination::Budget {
            budget_id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8".to_string(),
        }),
        data: None,
    };

    alert.validate().expect("valid alert");
}

#[test]
fn new_domain_alert_rejects_invalid_uuid_fields() {
    let cases = [
        (
            Some("not-a-uuid".to_string()),
            "budget.status",
            "occurrence-1",
            "Alert id must be a valid UUID",
        ),
        (
            None,
            "budget.status",
            "occurrence-1",
            "Budget destination budgetId must be a valid UUID",
        ),
    ];

    for (id, producer_key, occurrence_key, expected) in cases {
        let destination = if expected.contains("budgetId") {
            Some(DomainAlertDestination::Budget {
                budget_id: "bad".to_string(),
            })
        } else {
            None
        };
        let alert = NewDomainAlert {
            id,
            producer_key: producer_key.to_string(),
            occurrence_key: occurrence_key.to_string(),
            severity: DomainAlertSeverity::Info,
            title: "Title".to_string(),
            body: "Body".to_string(),
            destination,
            data: None,
        };

        let error = alert.validate().expect_err("expected validation failure");
        assert!(
            matches!(error, Error::InvalidData(ref message) if message == expected),
            "unexpected error: {error:?}"
        );
    }
}

#[test]
fn new_domain_alert_rejects_blank_keys_and_text() {
    let cases = [
        ("", "occurrence", "Producer key must be nonblank"),
        ("producer", "   ", "Occurrence key must be nonblank"),
        ("producer", "occurrence", "Title must be nonblank"),
    ];

    for (producer_key, occurrence_key, expected) in cases {
        let (title, body) = if expected.contains("Title") {
            ("   ", "Body")
        } else {
            ("Title", "Body")
        };
        let alert = NewDomainAlert {
            id: None,
            producer_key: producer_key.to_string(),
            occurrence_key: occurrence_key.to_string(),
            severity: DomainAlertSeverity::Info,
            title: title.to_string(),
            body: body.to_string(),
            destination: None,
            data: None,
        };

        let error = alert.validate().expect_err("expected validation failure");
        assert!(
            matches!(error, Error::InvalidData(ref message) if message == expected),
            "unexpected error: {error:?}"
        );
    }
}

#[test]
fn rich_data_requires_positive_version_and_json_object_payload() {
    let invalid_version = DomainAlertRichData {
        kind: "budget.status".to_string(),
        version: 0,
        payload: serde_json::Map::new(),
    };
    let error = NewDomainAlert {
        id: None,
        producer_key: "budget.status".to_string(),
        occurrence_key: "occurrence".to_string(),
        severity: DomainAlertSeverity::Info,
        title: "Title".to_string(),
        body: "Body".to_string(),
        destination: None,
        data: Some(invalid_version),
    }
    .validate()
    .expect_err("expected version failure");
    assert!(
        matches!(error, Error::InvalidData(message) if message == "Rich data version must be positive")
    );
}

#[test]
fn rich_data_enforces_inclusive_64_kib_limit() {
    let mut payload = serde_json::Map::new();
    payload.insert(
        "detail".to_string(),
        serde_json::Value::String("x".repeat(MAX_RICH_DATA_BYTES)),
    );
    let data = DomainAlertRichData {
        kind: "budget.status".to_string(),
        version: 1,
        payload,
    };

    let len = serde_json::to_string(&data).expect("serialize").len();
    assert!(len > MAX_RICH_DATA_BYTES);

    let error = NewDomainAlert {
        id: None,
        producer_key: "budget.status".to_string(),
        occurrence_key: "occurrence".to_string(),
        severity: DomainAlertSeverity::Info,
        title: "Title".to_string(),
        body: "Body".to_string(),
        destination: None,
        data: Some(data),
    }
    .validate()
    .expect_err("expected payload size failure");
    assert!(matches!(error, Error::InvalidData(message) if message.contains("65536")));
}

#[test]
fn rich_data_allows_exact_64_kib_boundary() {
    let mut fill = MAX_RICH_DATA_BYTES;
    loop {
        let mut payload = serde_json::Map::new();
        payload.insert(
            "detail".to_string(),
            serde_json::Value::String("a".repeat(fill)),
        );
        let candidate = DomainAlertRichData {
            kind: "budget.status".to_string(),
            version: 1,
            payload,
        };
        let len = serde_json::to_string(&candidate).expect("serialize").len();
        match len.cmp(&MAX_RICH_DATA_BYTES) {
            std::cmp::Ordering::Equal => {
                NewDomainAlert {
                    id: None,
                    producer_key: "budget.status".to_string(),
                    occurrence_key: "occurrence".to_string(),
                    severity: DomainAlertSeverity::Info,
                    title: "Title".to_string(),
                    body: "Body".to_string(),
                    destination: None,
                    data: Some(candidate),
                }
                .validate()
                .expect("boundary payload should validate");
                return;
            }
            std::cmp::Ordering::Greater => fill -= len - MAX_RICH_DATA_BYTES,
            std::cmp::Ordering::Less => fill += MAX_RICH_DATA_BYTES - len,
        }
    }
}

#[test]
fn uuid_validation_helper_matches_uuid_crate() {
    assert!(is_valid_uuid("550e8400-e29b-41d4-a716-446655440000"));
    assert!(!is_valid_uuid("not-a-uuid"));
}

#[test]
fn domain_alert_model_round_trips_serialization() {
    let alert = DomainAlert {
        id: "550e8400-e29b-41d4-a716-446655440000".to_string(),
        producer_key: "budget.status".to_string(),
        occurrence_key: "period-1".to_string(),
        severity: DomainAlertSeverity::Critical,
        title: "Critical".to_string(),
        body: "Body".to_string(),
        destination: Some(DomainAlertDestination::Budget {
            budget_id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8".to_string(),
        }),
        data: Some(DomainAlertRichData {
            kind: "budget.status".to_string(),
            version: 1,
            payload: serde_json::Map::from_iter([(
                "remainingAllowance".to_string(),
                serde_json::json!(-1500),
            )]),
        }),
        created_at: chrono::NaiveDate::from_ymd_opt(2026, 7, 14)
            .unwrap()
            .and_hms_opt(12, 0, 0)
            .unwrap(),
        updated_at: chrono::NaiveDate::from_ymd_opt(2026, 7, 14)
            .unwrap()
            .and_hms_opt(12, 0, 0)
            .unwrap(),
        read_at: None,
        resolved_at: None,
    };

    let serialized = serde_json::to_string(&alert).expect("serialize");
    assert!(serialized.contains("\"producerKey\""));
    assert!(serialized.contains("\"occurrenceKey\""));
    let restored: DomainAlert = serde_json::from_str(&serialized).expect("deserialize");
    assert_eq!(restored, alert);
}
