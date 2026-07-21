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
pub struct UpdateRecurringTransaction {
    pub recurring_transaction_id: String,
    pub expected_revision: i32,
    pub schedule: ScheduleRule,
    pub next_scheduled_local: NaiveDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_occurrences: Option<i32>,
    pub template: RecurringTemplateInput,
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

impl UpdateRecurringTransaction {
    pub fn validate_revision(&self) -> Result<()> {
        if self.expected_revision < 1 {
            return Err(Error::InvalidData(
                "Expected revision must be at least 1".to_string(),
            ));
        }
        Ok(())
    }

    pub fn validate_schedule(
        &self,
        observed_local: NaiveDateTime,
        earliest_allowed_next: NaiveDateTime,
    ) -> Result<()> {
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

    pub fn validate_count(&self, fulfilled_count: i32) -> Result<()> {
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

    pub fn validate_template(&self) -> Result<()> {
        self.template.validate()
    }
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

    fn base_input() -> UpdateRecurringTransaction {
        UpdateRecurringTransaction {
            recurring_transaction_id: "rt-1".into(),
            expected_revision: 1,
            schedule: ScheduleRule::Interval {
                every: 1,
                unit: ScheduleIntervalUnit::Month,
            },
            next_scheduled_local: observed(),
            total_occurrences: Some(12),
            template: RecurringTemplateInput {
                description: "Rent".into(),
                amount: 1000,
                transaction_type: "expense".into(),
                transaction_category_id: None,
                notes: None,
            },
        }
    }

    #[test]
    fn update_rejects_blank_description() {
        let mut input = base_input();
        input.template.description = "  ".into();
        assert!(input.validate_template().is_err());
    }

    #[test]
    fn update_rejects_revision_below_one() {
        let mut input = base_input();
        input.expected_revision = 0;
        assert!(input.validate_revision().is_err());
    }

    #[test]
    fn schedule_rejects_next_before_head_or_observation() {
        let input = base_input();
        let future_head = observed() + chrono::Duration::days(30);
        assert!(input.validate_schedule(observed(), future_head).is_err());
        assert!(input.validate_schedule(observed(), observed()).is_ok());
    }

    #[test]
    fn count_rejects_total_below_fulfilled() {
        let mut input = base_input();
        input.total_occurrences = Some(2);
        assert!(input.validate_count(3).is_err());
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
