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
    pub alert_state_changed: bool,
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
            alert_state_changed: false,
        }
    }

    pub fn with_alert_state_changed(mut self) -> Self {
        self.alert_state_changed = true;
        self
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
    if outcome.alert_state_changed {
        let _ = publisher.publish(&DomainAlertEvent::StateChanged);
    }
}
