use super::create::RecurringTemplateInput;
use super::document::RecurringTransactionDocument;
use super::models::ScheduleRule;
use super::schedule::scheduled_local_at;
use crate::{Error, Result};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

pub const UNCHANGED_NO_OPEN_FAILURE: &str = "no_open_failure";
pub const UNCHANGED_REPAIR_REQUIRED: &str = "repair_required";
pub const UNCHANGED_REPAIR_NOT_APPLICABLE: &str = "repair_not_applicable";
pub const UNCHANGED_ALREADY_REPAIRED: &str = "already_repaired";

pub const REPAIR_FIELD_CATEGORY: &str = "transaction_category_id";
pub const REPAIR_FIELD_AMOUNT: &str = "amount";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairRecurringGenerationFailure {
    pub recurring_transaction_id: String,
    pub expected_revision: i32,
    pub repair_field_key: String,
    pub template: RecurringTemplateInput,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryRecurringGenerationFailure {
    pub recurring_transaction_id: String,
    pub expected_revision: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRecurringGenerationRepair {
    pub recurring_transaction_id: String,
    pub repair_field_key: String,
    pub template: RecurringTemplateInput,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringRepairPreview {
    pub repair_field_key: String,
    pub affected_unfulfilled_segment_count: i32,
    pub includes_future_template: bool,
    pub next_action: RecurringRecoveryAction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecurringRecoveryAction {
    Repair,
    Retry,
    CopyDiagnostics,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationFailureDiagnostics {
    pub error_code: String,
    pub app_version: String,
    pub schema_version: String,
    pub first_failed_at: NaiveDateTime,
    pub last_failed_at: NaiveDateTime,
    pub typed_state: String,
    pub correlation_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "outcome", rename_all = "camelCase")]
pub enum RecurringRecoveryOutcome {
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

pub fn validate_expected_revision(expected_revision: i32) -> Result<()> {
    if expected_revision < 1 {
        return Err(Error::InvalidData(
            "Expected revision must be at least 1".to_string(),
        ));
    }
    Ok(())
}

impl RepairRecurringGenerationFailure {
    pub fn validate_revision(&self) -> Result<()> {
        validate_expected_revision(self.expected_revision)
    }

    pub fn validate_template(&self) -> Result<()> {
        self.template.validate()
    }

    pub fn validate_field_key(&self) -> Result<()> {
        validate_repairable_field_key(&self.repair_field_key)
    }
}

impl RetryRecurringGenerationFailure {
    pub fn validate_revision(&self) -> Result<()> {
        validate_expected_revision(self.expected_revision)
    }
}

impl PreviewRecurringGenerationRepair {
    pub fn validate_template(&self) -> Result<()> {
        self.template.validate()
    }

    pub fn validate_field_key(&self) -> Result<()> {
        validate_repairable_field_key(&self.repair_field_key)
    }
}

pub fn validate_repairable_field_key(repair_field_key: &str) -> Result<()> {
    match repair_field_key {
        REPAIR_FIELD_CATEGORY | REPAIR_FIELD_AMOUNT => Ok(()),
        _ => Err(Error::InvalidData(format!(
            "Unsupported repair field: {repair_field_key}"
        ))),
    }
}

pub fn recovery_action_for_failure(repair_field_key: Option<&str>) -> RecurringRecoveryAction {
    if repair_field_key.is_some_and(|key| validate_repairable_field_key(key).is_ok()) {
        RecurringRecoveryAction::Repair
    } else {
        RecurringRecoveryAction::Retry
    }
}

pub fn count_waiting_due_behind(
    rule: &ScheduleRule,
    first_scheduled_local: NaiveDateTime,
    failed_ordinal: i32,
    total_occurrences: Option<i32>,
    observed_local: NaiveDateTime,
) -> Result<i32> {
    if failed_ordinal < 1 {
        return Err(Error::InvalidData(
            "Failed ordinal must be at least 1".to_string(),
        ));
    }
    let max_ordinal = total_occurrences.unwrap_or(i32::MAX);
    let mut waiting = 0_i32;
    let mut ordinal = failed_ordinal
        .checked_add(1)
        .ok_or_else(|| Error::InvalidData("Occurrence ordinal overflow".to_string()))?;
    while ordinal <= max_ordinal {
        let scheduled = scheduled_local_at(rule, first_scheduled_local, ordinal)?;
        if scheduled > observed_local {
            break;
        }
        waiting = waiting
            .checked_add(1)
            .ok_or_else(|| Error::InvalidData("Waiting due count overflow".to_string()))?;
        ordinal = ordinal
            .checked_add(1)
            .ok_or_else(|| Error::InvalidData("Occurrence ordinal overflow".to_string()))?;
    }
    Ok(waiting)
}

pub fn diagnostics_typed_state() -> &'static str {
    "needs_attention"
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
    fn waiting_count_excludes_failed_slot_and_counts_later_due() {
        let first = NaiveDate::from_ymd_opt(2026, 4, 21)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap();
        let count = count_waiting_due_behind(&monthly(), first, 1, Some(6), observed()).unwrap();
        assert_eq!(count, 3);
    }

    #[test]
    fn waiting_count_zero_when_no_later_due() {
        let count = count_waiting_due_behind(&monthly(), observed(), 1, None, observed()).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn recovery_action_repair_when_field_known() {
        assert_eq!(
            recovery_action_for_failure(Some(REPAIR_FIELD_CATEGORY)),
            RecurringRecoveryAction::Repair
        );
        assert_eq!(
            recovery_action_for_failure(None),
            RecurringRecoveryAction::Retry
        );
        assert_eq!(
            recovery_action_for_failure(Some("template_revision_id")),
            RecurringRecoveryAction::Retry
        );
    }

    #[test]
    fn repair_rejects_blank_unsupported_field() {
        assert!(validate_repairable_field_key("notes").is_err());
        assert!(validate_repairable_field_key(REPAIR_FIELD_AMOUNT).is_ok());
    }
}
