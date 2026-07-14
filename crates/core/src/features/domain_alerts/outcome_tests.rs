use super::outcome::{AlertInsertOutcome, CommittedOutcome};
use super::{DomainAlert, DomainAlertSeverity};
use chrono::NaiveDate;

fn sample_alert() -> DomainAlert {
    DomainAlert {
        id: "550e8400-e29b-41d4-a716-446655440000".to_string(),
        producer_key: "budget.status".to_string(),
        occurrence_key: "period-1".to_string(),
        severity: DomainAlertSeverity::Info,
        title: "Title".to_string(),
        body: "Body".to_string(),
        destination: None,
        data: None,
        created_at: NaiveDate::from_ymd_opt(2026, 7, 14)
            .unwrap()
            .and_hms_opt(12, 0, 0)
            .unwrap(),
        read_at: None,
    }
}

#[test]
fn committed_outcome_includes_only_created_alerts() {
    let created = CommittedOutcome::new(
        "feature-value",
        AlertInsertOutcome::Created(Box::new(sample_alert())),
    );
    assert_eq!(created.value, "feature-value");
    assert_eq!(created.created_alerts.len(), 1);

    let deduped = CommittedOutcome::new("feature-value", AlertInsertOutcome::AlreadyExists);
    assert!(deduped.created_alerts.is_empty());
}
