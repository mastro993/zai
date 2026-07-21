use crate::Result;
use crate::features::domain_alerts::{
    DomainAlertDestination, DomainAlertRichData, DomainAlertSeverity, NewDomainAlert,
};
use serde_json::{Map, Value, json};

pub const RECURRING_OCCURRENCE_PRODUCER_KEY: &str = "recurring.occurrence";
pub const RECURRING_OCCURRENCE_RICH_KIND: &str = "recurring.occurrence";
pub const RECURRING_OCCURRENCE_RICH_VERSION: u32 = 1;
pub const RECURRING_GENERATION_FAILURE_PRODUCER_KEY: &str = "recurring.generation_failure";
pub const RECURRING_PROCESS_DELAY_PRODUCER_KEY: &str = "recurring.process_delay";
pub const RECURRING_PROCESS_DELAY_OCCURRENCE_KEY: &str = "process";

pub fn occurrence_identity_key(
    recurring_transaction_id: &str,
    schedule_revision_id: &str,
    ordinal: i32,
) -> String {
    format!("{recurring_transaction_id}|{schedule_revision_id}|{ordinal}")
}

pub fn build_generated_occurrence_alert(
    recurring_transaction_id: &str,
    recurring_name: &str,
    schedule_revision_id: &str,
    ordinal: i32,
    fulfillment_position: i32,
    transaction_id: &str,
    total_occurrences: Option<i32>,
) -> Result<NewDomainAlert> {
    let occurrence_key =
        occurrence_identity_key(recurring_transaction_id, schedule_revision_id, ordinal);
    let (title, body, data) = match total_occurrences {
        Some(total) => {
            let remaining = (total - fulfillment_position).max(0);
            (
                format!("{recurring_name} generated occurrence {fulfillment_position} of {total}"),
                format!(
                    "Zai created occurrence {fulfillment_position} of {total} for this recurring transaction. {remaining} remaining."
                ),
                build_rich_data(
                    recurring_transaction_id,
                    transaction_id,
                    Some(FiniteAlertCounts {
                        position: fulfillment_position,
                        total,
                        remaining,
                    }),
                ),
            )
        }
        None => (
            format!("{recurring_name} generated an occurrence"),
            "Zai created a scheduled occurrence for this recurring transaction.".to_string(),
            build_rich_data(recurring_transaction_id, transaction_id, None),
        ),
    };

    Ok(NewDomainAlert {
        id: None,
        producer_key: RECURRING_OCCURRENCE_PRODUCER_KEY.to_string(),
        occurrence_key,
        severity: DomainAlertSeverity::Info,
        title,
        body,
        destination: None,
        data: Some(data),
    })
}

struct FiniteAlertCounts {
    position: i32,
    total: i32,
    remaining: i32,
}

fn build_rich_data(
    recurring_transaction_id: &str,
    transaction_id: &str,
    counts: Option<FiniteAlertCounts>,
) -> DomainAlertRichData {
    let mut payload: Map<String, Value> = Map::from_iter([
        (
            "recurringTransactionId".to_string(),
            json!(recurring_transaction_id),
        ),
        ("transactionId".to_string(), json!(transaction_id)),
    ]);
    if let Some(counts) = counts {
        payload.insert("position".to_string(), json!(counts.position));
        payload.insert("total".to_string(), json!(counts.total));
        payload.insert("remaining".to_string(), json!(counts.remaining));
    }

    DomainAlertRichData {
        kind: RECURRING_OCCURRENCE_RICH_KIND.to_string(),
        version: RECURRING_OCCURRENCE_RICH_VERSION,
        payload,
    }
}

pub fn build_process_delay_alert() -> Result<NewDomainAlert> {
    Ok(NewDomainAlert {
        id: None,
        producer_key: RECURRING_PROCESS_DELAY_PRODUCER_KEY.to_string(),
        occurrence_key: RECURRING_PROCESS_DELAY_OCCURRENCE_KEY.to_string(),
        severity: DomainAlertSeverity::Critical,
        title: "Recurring processing delayed".to_string(),
        body: "Zai could not finish recurring catch-up because the local database was busy. Processing will retry automatically."
            .to_string(),
        destination: Some(DomainAlertDestination::RecurringTransactions),
        data: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finite_alert_includes_position_total_and_remaining() {
        let alert =
            build_generated_occurrence_alert("rt-1", "Rent", "sched-1", 2, 2, "txn-1", Some(5))
                .expect("alert");
        assert_eq!(alert.producer_key, RECURRING_OCCURRENCE_PRODUCER_KEY);
        assert_eq!(alert.occurrence_key, "rt-1|sched-1|2");
        assert!(alert.title.contains("2 of 5"));
        assert!(alert.body.contains("3 remaining"));
        let data = alert.data.expect("data");
        assert_eq!(data.payload.get("position"), Some(&json!(2)));
        assert_eq!(data.payload.get("total"), Some(&json!(5)));
        assert_eq!(data.payload.get("remaining"), Some(&json!(3)));
    }

    #[test]
    fn indefinite_alert_omits_counts() {
        let alert =
            build_generated_occurrence_alert("rt-1", "Salary", "sched-1", 1, 1, "txn-1", None)
                .expect("alert");
        assert!(!alert.title.contains(" of "));
        assert!(!alert.body.contains("remaining"));
        let data = alert.data.expect("data");
        assert!(!data.payload.contains_key("position"));
        assert!(!data.payload.contains_key("total"));
        assert!(!data.payload.contains_key("remaining"));
    }

    #[test]
    fn process_delay_alert_is_privacy_safe_and_dedupe_keyed() {
        let alert = build_process_delay_alert().expect("alert");
        assert_eq!(alert.producer_key, RECURRING_PROCESS_DELAY_PRODUCER_KEY);
        assert_eq!(alert.occurrence_key, RECURRING_PROCESS_DELAY_OCCURRENCE_KEY);
        assert_eq!(alert.title, "Recurring processing delayed");
        assert!(alert.body.contains("database was busy"));
        assert_eq!(
            alert.destination,
            Some(DomainAlertDestination::RecurringTransactions)
        );
        assert!(alert.data.is_none());
        assert!(!alert.title.to_ascii_lowercase().contains("amount"));
        assert!(!alert.body.to_ascii_lowercase().contains("account"));
    }
}
