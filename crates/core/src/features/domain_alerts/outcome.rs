use super::{DomainAlert, DomainAlertEvent, DomainAlertEventPublisher};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AlertInsertOutcome {
    Created(Box<DomainAlert>),
    AlreadyExists,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DomainAlertLifecycleOutcome {
    pub alert: DomainAlert,
    pub changed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommittedOutcome<T> {
    pub value: T,
    pub created_alerts: Vec<DomainAlert>,
}

impl<T> CommittedOutcome<T> {
    pub fn new(value: T, alert_outcome: AlertInsertOutcome) -> Self {
        Self::with_alert_outcomes(value, [alert_outcome])
    }

    pub fn with_alert_outcomes(
        value: T,
        outcomes: impl IntoIterator<Item = AlertInsertOutcome>,
    ) -> Self {
        let created_alerts = outcomes
            .into_iter()
            .filter_map(|outcome| match outcome {
                AlertInsertOutcome::Created(alert) => Some(*alert),
                AlertInsertOutcome::AlreadyExists => None,
            })
            .collect();

        Self {
            value,
            created_alerts,
        }
    }
}

pub fn publish_created_alerts<T>(
    publisher: &dyn DomainAlertEventPublisher,
    outcome: &CommittedOutcome<T>,
) {
    for alert in &outcome.created_alerts {
        let _ = publisher.publish(&DomainAlertEvent::Created {
            alert: Box::new(alert.clone()),
        });
    }
}
