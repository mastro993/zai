use super::DomainAlert;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AlertInsertOutcome {
    Created(Box<DomainAlert>),
    AlreadyExists,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommittedOutcome<T> {
    pub value: T,
    pub created_alerts: Vec<DomainAlert>,
}

impl<T> CommittedOutcome<T> {
    pub fn new(value: T, alert_outcome: AlertInsertOutcome) -> Self {
        let created_alerts = match alert_outcome {
            AlertInsertOutcome::Created(alert) => vec![*alert],
            AlertInsertOutcome::AlreadyExists => Vec::new(),
        };

        Self {
            value,
            created_alerts,
        }
    }
}
