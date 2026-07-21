use super::models::RecurringOccurrence;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub const DEFAULT_PROCESS_MAX_OCCURRENCES: u32 = 100;
pub const DEFAULT_PROCESS_MAX_DURATION: Duration = Duration::from_millis(50);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingWorkBudget {
    pub max_occurrences: u32,
    #[serde(with = "duration_millis")]
    pub max_duration: Duration,
}

impl ProcessingWorkBudget {
    pub fn default_slice() -> Self {
        Self {
            max_occurrences: DEFAULT_PROCESS_MAX_OCCURRENCES,
            max_duration: DEFAULT_PROCESS_MAX_DURATION,
        }
    }

    pub fn occurrences(max_occurrences: u32) -> Self {
        Self {
            max_occurrences,
            max_duration: DEFAULT_PROCESS_MAX_DURATION,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProcessingStopReason {
    CaughtUp,
    BudgetExhausted,
    TransientlyDelayed,
    Cancelled,
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

mod duration_millis {
    use serde::{Deserialize, Deserializer, Serializer};
    use std::time::Duration;

    pub fn serialize<S>(value: &Duration, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_u64(value.as_millis() as u64)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Duration, D::Error>
    where
        D: Deserializer<'de>,
    {
        let millis = u64::deserialize(deserializer)?;
        Ok(Duration::from_millis(millis))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_slice_uses_contract_occurrence_and_duration_budget() {
        let budget = ProcessingWorkBudget::default_slice();
        assert_eq!(budget.max_occurrences, DEFAULT_PROCESS_MAX_OCCURRENCES);
        assert_eq!(budget.max_duration, DEFAULT_PROCESS_MAX_DURATION);
    }
}
