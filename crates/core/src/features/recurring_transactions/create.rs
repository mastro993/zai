use super::models::ScheduleRule;
use super::schedule::validate_schedule_rule;
use crate::{Error, Result};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringTemplateInput {
    pub description: String,
    pub amount: i32,
    pub transaction_type: String,
    pub transaction_category_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewRecurringTransaction {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub schedule: ScheduleRule,
    pub first_scheduled_local: NaiveDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_occurrences: Option<i32>,
    pub template: RecurringTemplateInput,
}

impl NewRecurringTransaction {
    pub fn validate(&self) -> Result<()> {
        validate_schedule_rule(&self.schedule)?;
        if let Some(total) = self.total_occurrences
            && total < 1
        {
            return Err(Error::InvalidData(
                "Finite total must be a positive integer".to_string(),
            ));
        }
        self.template.validate()?;
        Ok(())
    }
}

impl RecurringTemplateInput {
    pub fn validate(&self) -> Result<()> {
        if normalize_template_description(&self.description).is_empty() {
            return Err(Error::InvalidData(
                "Recurring transaction description cannot be empty".to_string(),
            ));
        }
        if self.amount < 0 {
            return Err(Error::InvalidData(
                "Template amount cannot be negative".to_string(),
            ));
        }
        match self.transaction_type.as_str() {
            "expense" | "income" => Ok(()),
            _ => Err(Error::InvalidData(format!(
                "Invalid transaction type: {}",
                self.transaction_type
            ))),
        }
    }
}

pub fn normalize_template_description(description: &str) -> String {
    description.trim().to_string()
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

    fn valid_new() -> NewRecurringTransaction {
        NewRecurringTransaction {
            id: None,
            schedule: ScheduleRule::Interval {
                every: 1,
                unit: ScheduleIntervalUnit::Month,
            },
            first_scheduled_local: observed(),
            total_occurrences: None,
            template: RecurringTemplateInput {
                description: "  Rent  ".to_string(),
                amount: 120_000,
                transaction_type: "expense".to_string(),
                transaction_category_id: None,
                notes: None,
            },
        }
    }

    #[test]
    fn accepts_valid_from_scratch_create() {
        assert!(valid_new().validate().is_ok());
    }

    #[test]
    fn accepts_first_occurrence_in_the_past() {
        let mut input = valid_new();
        input.first_scheduled_local = observed() - chrono::Duration::days(90);
        assert!(input.validate().is_ok());
    }

    #[test]
    fn rejects_empty_description_and_non_positive_total() {
        let mut input = valid_new();
        input.template.description = "   ".to_string();
        let error = input.validate().unwrap_err();
        assert!(error.to_string().contains("description"));
        input = valid_new();
        input.total_occurrences = Some(0);
        assert!(input.validate().is_err());
    }
}
