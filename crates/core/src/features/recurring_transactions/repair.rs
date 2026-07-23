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
pub const UNCHANGED_RETRY_FAILED: &str = "retry_failed";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecurringRepairField {
    Amount,
    TransactionCategoryId,
}

impl RecurringRepairField {
    pub const fn storage_key(self) -> &'static str {
        match self {
            Self::Amount => "amount",
            Self::TransactionCategoryId => "transactionCategoryId",
        }
    }

    pub fn from_storage_key(value: &str) -> Result<Self> {
        match value {
            "amount" => Ok(Self::Amount),
            "transactionCategoryId" | "transaction_category_id" => Ok(Self::TransactionCategoryId),
            _ => Err(Error::InvalidRecurringRepairField(value.to_string())),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairRecurringGenerationFailure {
    pub recurring_transaction_id: String,
    pub expected_revision: i32,
    pub repair_field_key: RecurringRepairField,
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
    pub repair_field_key: RecurringRepairField,
    pub template: RecurringTemplateInput,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringRepairPreview {
    pub repair_field_key: RecurringRepairField,
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
}

pub fn recovery_action_for_failure(
    repair_field_key: Option<RecurringRepairField>,
) -> RecurringRecoveryAction {
    if repair_field_key.is_some() {
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
            recovery_action_for_failure(Some(RecurringRepairField::TransactionCategoryId)),
            RecurringRecoveryAction::Repair
        );
        assert_eq!(
            recovery_action_for_failure(None),
            RecurringRecoveryAction::Retry
        );
        assert!(matches!(
            RecurringRepairField::from_storage_key("unknown"),
            Err(Error::InvalidRecurringRepairField(value)) if value == "unknown"
        ));
    }

    #[test]
    fn repair_field_serializes_with_canonical_wire_values() {
        assert_eq!(
            serde_json::to_string(&RecurringRepairField::TransactionCategoryId).unwrap(),
            "\"transactionCategoryId\""
        );
        assert_eq!(
            RecurringRepairField::from_storage_key("transaction_category_id").unwrap(),
            RecurringRepairField::TransactionCategoryId
        );
    }
}
