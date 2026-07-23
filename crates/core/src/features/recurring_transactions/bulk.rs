use super::edit::UNCHANGED_GENERATION_BLOCKED;
use super::lifecycle::{
    RecurringLifecycleCommand, UNCHANGED_INVALID_TRANSITION, transition_allowed,
};
use super::models::{RecurringLifecycle, ScheduleRule};
use super::repair::{
    RecurringRecoveryAction, RecurringRepairField, UNCHANGED_NO_OPEN_FAILURE,
    UNCHANGED_REPAIR_REQUIRED, recovery_action_for_failure,
};
use super::schedule::scheduled_local_at;
use crate::{Error, Result};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const MAX_BULK_SELECTION: usize = 500;
pub const UNCHANGED_NOT_FOUND: &str = "not_found";
pub const UNCHANGED_REVISION_CONFLICT: &str = "revision_conflict";
pub const NEXT_ACTION_REPAIR: &str = "repair";
pub const NEXT_ACTION_RETRY: &str = "retry";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecurringBulkAction {
    Pause,
    Resume,
    Stop,
    Delete,
    RetryNow,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringBulkItem {
    pub recurring_transaction_id: String,
    pub expected_revision: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringBulkRequest {
    pub action: RecurringBulkAction,
    pub items: Vec<RecurringBulkItem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecurringBulkLifecycleCounts {
    pub active: i32,
    pub paused: i32,
    pub stopped: i32,
    pub completed: i32,
    pub needs_attention: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringBulkUnchangedItem {
    pub recurring_transaction_id: String,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_action: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringBulkPreflight {
    pub selected: i32,
    pub eligible: i32,
    pub unchanged: i32,
    pub lifecycle: RecurringBulkLifecycleCounts,
    pub due_catch_up: i32,
    pub waiting: i32,
    pub repair_needed: i32,
    pub eligible_items: Vec<RecurringBulkItem>,
    pub unchanged_items: Vec<RecurringBulkUnchangedItem>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecurringBulkItemOutcomeKind {
    Succeeded,
    Unchanged,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringBulkItemResult {
    pub recurring_transaction_id: String,
    pub outcome: RecurringBulkItemOutcomeKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_action: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringBulkExecuteResult {
    pub results: Vec<RecurringBulkItemResult>,
    pub succeeded: i32,
    pub unchanged: i32,
    pub failed: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringMatchingIdentity {
    pub recurring_transaction_id: String,
    pub expected_revision: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringMatchingIds {
    pub fingerprint: String,
    pub items: Vec<RecurringMatchingIdentity>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BulkEligibility {
    Eligible,
    Unchanged {
        reason: &'static str,
        next_action: Option<&'static str>,
    },
}

impl RecurringBulkAction {
    pub const fn as_lifecycle_command(self) -> Option<RecurringLifecycleCommand> {
        match self {
            Self::Pause => Some(RecurringLifecycleCommand::Pause),
            Self::Resume => Some(RecurringLifecycleCommand::Resume),
            Self::Stop => Some(RecurringLifecycleCommand::Stop),
            Self::Delete => Some(RecurringLifecycleCommand::Delete),
            Self::RetryNow => None,
        }
    }

    pub const fn requires_catch_up(self) -> bool {
        matches!(self, Self::Pause | Self::Stop | Self::Delete)
    }

    pub const fn is_retry(self) -> bool {
        matches!(self, Self::RetryNow)
    }
}

impl RecurringBulkRequest {
    pub fn validate_bound(&self) -> Result<()> {
        if self.items.is_empty() {
            return Err(Error::InvalidData(
                "Bulk selection must include at least one identity".to_string(),
            ));
        }
        if self.items.len() > MAX_BULK_SELECTION {
            return Err(Error::InvalidData(format!(
                "Bulk selection cannot exceed {MAX_BULK_SELECTION} identities"
            )));
        }
        for item in &self.items {
            if item.recurring_transaction_id.trim().is_empty() {
                return Err(Error::InvalidData(
                    "Recurring transaction id cannot be blank".to_string(),
                ));
            }
            if item.expected_revision < 1 {
                return Err(Error::InvalidData(
                    "Expected revision must be at least 1".to_string(),
                ));
            }
        }
        let mut ids = HashSet::with_capacity(self.items.len());
        if self
            .items
            .iter()
            .any(|item| !ids.insert(&item.recurring_transaction_id))
        {
            return Err(Error::InvalidData(
                "Bulk selection cannot contain duplicate identities".to_string(),
            ));
        }
        Ok(())
    }
}

pub fn classify_lifecycle_eligibility(
    lifecycle: RecurringLifecycle,
    generation_blocked: bool,
    command: RecurringLifecycleCommand,
) -> BulkEligibility {
    if !transition_allowed(lifecycle, command) {
        return BulkEligibility::Unchanged {
            reason: UNCHANGED_INVALID_TRANSITION,
            next_action: None,
        };
    }
    if generation_blocked {
        return BulkEligibility::Unchanged {
            reason: UNCHANGED_GENERATION_BLOCKED,
            next_action: Some(NEXT_ACTION_REPAIR),
        };
    }
    BulkEligibility::Eligible
}

pub fn classify_retry_eligibility(
    has_open_failure: bool,
    repair_field_key: Option<RecurringRepairField>,
) -> BulkEligibility {
    if !has_open_failure {
        return BulkEligibility::Unchanged {
            reason: UNCHANGED_NO_OPEN_FAILURE,
            next_action: None,
        };
    }
    match recovery_action_for_failure(repair_field_key) {
        RecurringRecoveryAction::Repair => BulkEligibility::Unchanged {
            reason: UNCHANGED_REPAIR_REQUIRED,
            next_action: Some(NEXT_ACTION_REPAIR),
        },
        RecurringRecoveryAction::Retry | RecurringRecoveryAction::CopyDiagnostics => {
            BulkEligibility::Eligible
        }
    }
}

pub fn count_due_from_head(
    rule: &ScheduleRule,
    first_scheduled_local: NaiveDateTime,
    next_ordinal: i32,
    total_occurrences: Option<i32>,
    observed_local: NaiveDateTime,
) -> Result<i32> {
    if next_ordinal < 1 {
        return Err(Error::InvalidData(
            "Occurrence ordinal must be at least 1".to_string(),
        ));
    }
    let max_ordinal = total_occurrences.unwrap_or(i32::MAX);
    let mut due = 0_i32;
    let mut ordinal = next_ordinal;
    while ordinal <= max_ordinal {
        let scheduled = scheduled_local_at(rule, first_scheduled_local, ordinal)?;
        if scheduled > observed_local {
            break;
        }
        due = due
            .checked_add(1)
            .ok_or_else(|| Error::InvalidData("Due catch-up count overflow".to_string()))?;
        ordinal = ordinal
            .checked_add(1)
            .ok_or_else(|| Error::InvalidData("Occurrence ordinal overflow".to_string()))?;
    }
    Ok(due)
}

pub fn record_lifecycle(counts: &mut RecurringBulkLifecycleCounts, lifecycle: RecurringLifecycle) {
    match lifecycle {
        RecurringLifecycle::Active => counts.active += 1,
        RecurringLifecycle::Paused => counts.paused += 1,
        RecurringLifecycle::Stopped => counts.stopped += 1,
        RecurringLifecycle::Completed => counts.completed += 1,
        RecurringLifecycle::Tombstoned => {}
    }
}

#[cfg(test)]
#[path = "bulk_tests.rs"]
mod tests;
