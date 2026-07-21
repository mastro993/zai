use super::create::RecurringTemplateInput;
use super::models::ScheduleRule;
use super::schedule::{scheduled_local_at, validate_schedule_rule};
use crate::{Error, Result};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdoptRecurringTransaction {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub transaction_id: String,
    pub schedule: ScheduleRule,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_occurrences: Option<i32>,
    pub template: RecurringTemplateInput,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdoptionPreviewRequest {
    pub transaction_id: String,
    pub schedule: ScheduleRule,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_occurrences: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdoptionPreview {
    pub transaction_id: String,
    pub first_scheduled_local: NaiveDateTime,
    pub later_due_count: i32,
}

impl AdoptRecurringTransaction {
    pub fn validate_inputs(&self) -> Result<()> {
        validate_adopt_base(&self.transaction_id, &self.schedule, self.total_occurrences)?;
        self.template.validate()?;
        Ok(())
    }
}

impl AdoptionPreviewRequest {
    pub fn validate_inputs(&self) -> Result<()> {
        validate_adopt_base(&self.transaction_id, &self.schedule, self.total_occurrences)
    }
}

fn validate_adopt_base(
    transaction_id: &str,
    schedule: &ScheduleRule,
    total_occurrences: Option<i32>,
) -> Result<()> {
    if transaction_id.trim().is_empty() {
        return Err(Error::InvalidData(
            "Transaction id cannot be blank".to_string(),
        ));
    }
    validate_schedule_rule(schedule)?;
    if let Some(total) = total_occurrences
        && total < 1
    {
        return Err(Error::InvalidData(
            "Finite total must be a positive integer".to_string(),
        ));
    }
    Ok(())
}

pub fn count_later_due_occurrences(
    rule: &ScheduleRule,
    first_scheduled_local: NaiveDateTime,
    total_occurrences: Option<i32>,
    observed_local: NaiveDateTime,
) -> Result<i32> {
    let max_ordinal = total_occurrences.unwrap_or(i32::MAX);
    if max_ordinal < 2 {
        return Ok(0);
    }

    let mut later_due = 0_i32;
    let mut ordinal = 2_i32;
    while ordinal <= max_ordinal {
        let scheduled = scheduled_local_at(rule, first_scheduled_local, ordinal)?;
        if scheduled > observed_local {
            break;
        }
        later_due = later_due
            .checked_add(1)
            .ok_or_else(|| Error::InvalidData("Later due count overflow".to_string()))?;
        ordinal = ordinal
            .checked_add(1)
            .ok_or_else(|| Error::InvalidData("Occurrence ordinal overflow".to_string()))?;
    }
    Ok(later_due)
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

    fn monthly() -> ScheduleRule {
        ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Month,
        }
    }

    #[test]
    fn preview_counts_later_due_for_older_first_occurrence() {
        let first = NaiveDate::from_ymd_opt(2026, 4, 21)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap();
        let count = count_later_due_occurrences(&monthly(), first, Some(6), observed()).unwrap();
        assert_eq!(count, 3);
    }

    #[test]
    fn preview_returns_zero_when_only_occurrence_one_is_due() {
        let first = observed();
        let count = count_later_due_occurrences(&monthly(), first, None, observed()).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn preview_respects_finite_total_of_one() {
        let first = NaiveDate::from_ymd_opt(2026, 1, 1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap();
        let count = count_later_due_occurrences(&monthly(), first, Some(1), observed()).unwrap();
        assert_eq!(count, 0);
    }
}
