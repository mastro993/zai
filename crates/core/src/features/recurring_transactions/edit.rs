use super::create::RecurringTemplateInput;
use super::document::RecurringTransactionDocument;
use super::models::{RecurringLifecycle, ScheduleRule};
use super::schedule::validate_schedule_rule;
use crate::{Error, Result};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

pub const UNCHANGED_SAME_VALUE: &str = "same_value";
pub const UNCHANGED_NOT_EDITABLE: &str = "not_editable";
pub const UNCHANGED_GENERATION_BLOCKED: &str = "generation_blocked";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameRecurringTransaction {
    pub recurring_transaction_id: String,
    pub expected_revision: i32,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditRecurringSchedule {
    pub recurring_transaction_id: String,
    pub expected_revision: i32,
    pub schedule: ScheduleRule,
    pub next_scheduled_local: NaiveDateTime,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditRecurringTemplate {
    pub recurring_transaction_id: String,
    pub expected_revision: i32,
    pub template: RecurringTemplateInput,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditRecurringCount {
    pub recurring_transaction_id: String,
    pub expected_revision: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_occurrences: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "outcome", rename_all = "camelCase")]
pub enum RecurringMutationOutcome {
    Succeeded {
        document: RecurringTransactionDocument,
    },
    AlreadyApplied {
        document: RecurringTransactionDocument,
    },
    Unchanged {
        document: RecurringTransactionDocument,
        reason: String,
    },
}

impl RenameRecurringTransaction {
    pub fn validate(&self) -> Result<String> {
        if self.expected_revision < 1 {
            return Err(Error::InvalidData(
                "Expected revision must be at least 1".to_string(),
            ));
        }
        let name = super::create::normalize_recurring_name(&self.name);
        if name.is_empty() {
            return Err(Error::InvalidData(
                "Recurring transaction name cannot be empty".to_string(),
            ));
        }
        Ok(name)
    }
}

impl EditRecurringSchedule {
    pub fn validate(
        &self,
        observed_local: NaiveDateTime,
        earliest_allowed_next: NaiveDateTime,
    ) -> Result<()> {
        if self.expected_revision < 1 {
            return Err(Error::InvalidData(
                "Expected revision must be at least 1".to_string(),
            ));
        }
        validate_schedule_rule(&self.schedule)?;
        let minimum = if earliest_allowed_next > observed_local {
            earliest_allowed_next
        } else {
            observed_local
        };
        if self.next_scheduled_local < minimum {
            return Err(Error::InvalidData(
                "Next occurrence cannot be before the current head or edit observation".to_string(),
            ));
        }
        Ok(())
    }
}

impl EditRecurringTemplate {
    pub fn validate(&self) -> Result<()> {
        if self.expected_revision < 1 {
            return Err(Error::InvalidData(
                "Expected revision must be at least 1".to_string(),
            ));
        }
        self.template.validate()
    }
}

impl EditRecurringCount {
    pub fn validate(&self, fulfilled_count: i32) -> Result<()> {
        if self.expected_revision < 1 {
            return Err(Error::InvalidData(
                "Expected revision must be at least 1".to_string(),
            ));
        }
        if let Some(total) = self.total_occurrences {
            if total < 1 {
                return Err(Error::InvalidData(
                    "Finite total must be a positive integer".to_string(),
                ));
            }
            if total < fulfilled_count {
                return Err(Error::InvalidData(
                    "Finite total cannot be below the fulfilled count".to_string(),
                ));
            }
        }
        Ok(())
    }
}

pub fn rename_allowed(lifecycle: RecurringLifecycle) -> bool {
    matches!(
        lifecycle,
        RecurringLifecycle::Active
            | RecurringLifecycle::Paused
            | RecurringLifecycle::Stopped
            | RecurringLifecycle::Completed
    )
}

pub fn configuration_edit_allowed(lifecycle: RecurringLifecycle, generation_blocked: bool) -> bool {
    matches!(
        lifecycle,
        RecurringLifecycle::Active | RecurringLifecycle::Paused
    ) && !generation_blocked
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::recurring_transactions::{ScheduleIntervalUnit, ScheduleRule};
    use chrono::NaiveDate;

    fn observed() -> NaiveDateTime {
        NaiveDate::from_ymd_opt(2026, 7, 21)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap()
    }

    #[test]
    fn rename_rejects_blank_name() {
        let input = RenameRecurringTransaction {
            recurring_transaction_id: "rt-1".into(),
            expected_revision: 1,
            name: "  ".into(),
        };
        assert!(input.validate().is_err());
    }

    #[test]
    fn schedule_rejects_next_before_head_or_observation() {
        let input = EditRecurringSchedule {
            recurring_transaction_id: "rt-1".into(),
            expected_revision: 1,
            schedule: ScheduleRule::Interval {
                every: 1,
                unit: ScheduleIntervalUnit::Month,
            },
            next_scheduled_local: observed(),
        };
        let future_head = observed() + chrono::Duration::days(30);
        assert!(input.validate(observed(), future_head).is_err());
        assert!(input.validate(observed(), observed()).is_ok());
    }

    #[test]
    fn count_rejects_total_below_fulfilled() {
        let input = EditRecurringCount {
            recurring_transaction_id: "rt-1".into(),
            expected_revision: 1,
            total_occurrences: Some(2),
        };
        assert!(input.validate(3).is_err());
    }

    #[test]
    fn configuration_blocked_when_generation_blocked() {
        assert!(!configuration_edit_allowed(
            RecurringLifecycle::Active,
            true
        ));
        assert!(configuration_edit_allowed(
            RecurringLifecycle::Paused,
            false
        ));
        assert!(!configuration_edit_allowed(
            RecurringLifecycle::Stopped,
            false
        ));
    }
}
