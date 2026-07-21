use super::models::RecurringOccurrence;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

pub const DEFAULT_PROCESS_MAX_OCCURRENCES: u32 = 100;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingWorkBudget {
    pub max_occurrences: u32,
}

impl ProcessingWorkBudget {
    pub fn default_slice() -> Self {
        Self {
            max_occurrences: DEFAULT_PROCESS_MAX_OCCURRENCES,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProcessingStopReason {
    CaughtUp,
    BudgetExhausted,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingSliceOutcome {
    pub committed: u32,
    pub already_fulfilled: u32,
    pub more_due_remaining: bool,
    pub stop_reason: ProcessingStopReason,
    pub observed_local: NaiveDateTime,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProcessOneOutcome {
    Committed(RecurringOccurrence),
    AlreadyFulfilled(RecurringOccurrence),
    NoEligibleWork,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_slice_uses_contract_occurrence_budget() {
        assert_eq!(
            ProcessingWorkBudget::default_slice().max_occurrences,
            DEFAULT_PROCESS_MAX_OCCURRENCES
        );
    }
}
