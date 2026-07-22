use super::document::RecurringTransactionDocument;
use super::models::RecurringLifecycle;
use crate::{Error, Result};
use serde::{Deserialize, Serialize};

pub const UNCHANGED_INVALID_TRANSITION: &str = "invalid_transition";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecurringLifecycleCommand {
    Pause,
    Resume,
    Stop,
    Delete,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringLifecycleUpdate {
    pub recurring_transaction_id: String,
    pub expected_revision: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "outcome", rename_all = "camelCase")]
pub enum RecurringLifecycleOutcome {
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

impl RecurringLifecycleUpdate {
    pub fn validate_revision(&self) -> Result<()> {
        if self.expected_revision < 1 {
            return Err(Error::InvalidData(
                "Expected revision must be at least 1".to_string(),
            ));
        }
        Ok(())
    }
}

impl RecurringLifecycleCommand {
    pub const fn target_lifecycle(self) -> RecurringLifecycle {
        match self {
            Self::Pause => RecurringLifecycle::Paused,
            Self::Resume => RecurringLifecycle::Active,
            Self::Stop => RecurringLifecycle::Stopped,
            Self::Delete => RecurringLifecycle::Tombstoned,
        }
    }

    pub const fn requires_catch_up(self) -> bool {
        matches!(self, Self::Pause | Self::Stop | Self::Delete)
    }

    pub const fn requires_pause_skip(self) -> bool {
        matches!(self, Self::Resume)
    }
}

/// Returns whether `command` may leave `from`.
pub fn transition_allowed(from: RecurringLifecycle, command: RecurringLifecycleCommand) -> bool {
    match command {
        RecurringLifecycleCommand::Pause => matches!(from, RecurringLifecycle::Active),
        RecurringLifecycleCommand::Resume => matches!(from, RecurringLifecycle::Paused),
        RecurringLifecycleCommand::Stop => {
            matches!(
                from,
                RecurringLifecycle::Active | RecurringLifecycle::Paused
            )
        }
        RecurringLifecycleCommand::Delete => matches!(
            from,
            RecurringLifecycle::Active
                | RecurringLifecycle::Paused
                | RecurringLifecycle::Stopped
                | RecurringLifecycle::Completed
        ),
    }
}

/// Rename (template description) stays available for retained visible sources.
pub fn description_edit_allowed(lifecycle: RecurringLifecycle) -> bool {
    matches!(
        lifecycle,
        RecurringLifecycle::Active
            | RecurringLifecycle::Paused
            | RecurringLifecycle::Stopped
            | RecurringLifecycle::Completed
    )
}

/// Stopped and completed keep description editable but lock schedule/template/count.
pub fn configuration_locked_terminal(lifecycle: RecurringLifecycle) -> bool {
    matches!(
        lifecycle,
        RecurringLifecycle::Stopped | RecurringLifecycle::Completed
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_allows_every_specified_transition() {
        let cases = [
            (RecurringLifecycle::Active, RecurringLifecycleCommand::Pause),
            (RecurringLifecycle::Active, RecurringLifecycleCommand::Stop),
            (
                RecurringLifecycle::Active,
                RecurringLifecycleCommand::Delete,
            ),
            (
                RecurringLifecycle::Paused,
                RecurringLifecycleCommand::Resume,
            ),
            (RecurringLifecycle::Paused, RecurringLifecycleCommand::Stop),
            (
                RecurringLifecycle::Paused,
                RecurringLifecycleCommand::Delete,
            ),
            (
                RecurringLifecycle::Stopped,
                RecurringLifecycleCommand::Delete,
            ),
            (
                RecurringLifecycle::Completed,
                RecurringLifecycleCommand::Delete,
            ),
        ];
        for (from, command) in cases {
            assert!(
                transition_allowed(from, command),
                "{from:?} + {command:?} should be allowed"
            );
        }
    }

    #[test]
    fn model_rejects_illegal_transitions() {
        let cases = [
            (RecurringLifecycle::Paused, RecurringLifecycleCommand::Pause),
            (
                RecurringLifecycle::Active,
                RecurringLifecycleCommand::Resume,
            ),
            (
                RecurringLifecycle::Stopped,
                RecurringLifecycleCommand::Pause,
            ),
            (
                RecurringLifecycle::Stopped,
                RecurringLifecycleCommand::Resume,
            ),
            (RecurringLifecycle::Stopped, RecurringLifecycleCommand::Stop),
            (
                RecurringLifecycle::Completed,
                RecurringLifecycleCommand::Pause,
            ),
            (
                RecurringLifecycle::Completed,
                RecurringLifecycleCommand::Resume,
            ),
            (
                RecurringLifecycle::Completed,
                RecurringLifecycleCommand::Stop,
            ),
            (
                RecurringLifecycle::Tombstoned,
                RecurringLifecycleCommand::Pause,
            ),
            (
                RecurringLifecycle::Tombstoned,
                RecurringLifecycleCommand::Resume,
            ),
            (
                RecurringLifecycle::Tombstoned,
                RecurringLifecycleCommand::Stop,
            ),
            (
                RecurringLifecycle::Tombstoned,
                RecurringLifecycleCommand::Delete,
            ),
        ];
        for (from, command) in cases {
            assert!(
                !transition_allowed(from, command),
                "{from:?} + {command:?} should be rejected"
            );
        }
    }

    #[test]
    fn pause_stop_delete_require_catch_up_resume_requires_skip() {
        assert!(RecurringLifecycleCommand::Pause.requires_catch_up());
        assert!(RecurringLifecycleCommand::Stop.requires_catch_up());
        assert!(RecurringLifecycleCommand::Delete.requires_catch_up());
        assert!(!RecurringLifecycleCommand::Resume.requires_catch_up());
        assert!(RecurringLifecycleCommand::Resume.requires_pause_skip());
        assert!(!RecurringLifecycleCommand::Pause.requires_pause_skip());
    }

    #[test]
    fn description_edit_allowed_for_visible_non_tombstone() {
        assert!(description_edit_allowed(RecurringLifecycle::Active));
        assert!(description_edit_allowed(RecurringLifecycle::Paused));
        assert!(description_edit_allowed(RecurringLifecycle::Stopped));
        assert!(description_edit_allowed(RecurringLifecycle::Completed));
        assert!(!description_edit_allowed(RecurringLifecycle::Tombstoned));
        assert!(configuration_locked_terminal(RecurringLifecycle::Stopped));
        assert!(configuration_locked_terminal(RecurringLifecycle::Completed));
        assert!(!configuration_locked_terminal(RecurringLifecycle::Active));
    }

    #[test]
    fn lifecycle_update_rejects_revision_below_one() {
        let update = RecurringLifecycleUpdate {
            recurring_transaction_id: "rt-1".into(),
            expected_revision: 0,
        };
        assert!(update.validate_revision().is_err());
    }
}
