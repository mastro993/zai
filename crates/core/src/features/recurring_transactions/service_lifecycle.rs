use super::edit::UNCHANGED_GENERATION_BLOCKED;
use super::lifecycle::{
    RecurringLifecycleCommand, RecurringLifecycleOutcome, RecurringLifecycleUpdate,
    UNCHANGED_INVALID_TRANSITION, transition_allowed,
};
use super::models::RecurringLifecycle;
use super::process::{ProcessingStopReason, ProcessingWorkBudget};
use super::service::RecurringTransactionsService;
use super::traits::{RecurringOccurrenceProcessor, RecurringTransactionsServiceTrait};
use crate::{Error, Result};

impl RecurringTransactionsService {
    pub(super) async fn apply_lifecycle(
        &self,
        command: RecurringLifecycleCommand,
        update: RecurringLifecycleUpdate,
    ) -> Result<RecurringLifecycleOutcome> {
        update.validate_revision()?;
        let observed_local = self.clock.sample();

        let recurring = self
            .repository
            .get_recurring_transaction(&update.recurring_transaction_id)
            .await?;

        if recurring.lifecycle == RecurringLifecycle::Tombstoned || recurring.deleted_at.is_some() {
            return Err(Error::NotFound(format!(
                "Recurring transaction {} not found",
                recurring.id
            )));
        }

        if recurring.revision != update.expected_revision {
            if recurring.lifecycle == command.target_lifecycle() {
                let document = self.get_document(&recurring.id).await?;
                return Ok(RecurringLifecycleOutcome::AlreadyApplied { document });
            }
            return Err(Error::RevisionConflict {
                current_revision: i64::from(recurring.revision),
            });
        }

        if !transition_allowed(recurring.lifecycle, command) {
            if recurring.lifecycle == command.target_lifecycle() {
                let document = self.get_document(&recurring.id).await?;
                return Ok(RecurringLifecycleOutcome::Unchanged {
                    document,
                    reason: UNCHANGED_INVALID_TRANSITION.to_string(),
                });
            }
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringLifecycleOutcome::Unchanged {
                document,
                reason: UNCHANGED_INVALID_TRANSITION.to_string(),
            });
        }

        if command.requires_catch_up()
            && matches!(
                recurring.lifecycle,
                RecurringLifecycle::Active | RecurringLifecycle::Paused
            )
        {
            if self.source_generation_blocked(&recurring.id).await? {
                let document = self.get_document(&recurring.id).await?;
                return Ok(RecurringLifecycleOutcome::Unchanged {
                    document,
                    reason: UNCHANGED_GENERATION_BLOCKED.to_string(),
                });
            }

            // Active sources catch up through the frozen observation first.
            if recurring.lifecycle == RecurringLifecycle::Active {
                self.catch_up_through_observation(observed_local).await?;
                if self.source_generation_blocked(&recurring.id).await? {
                    let document = self.get_document(&recurring.id).await?;
                    return Ok(RecurringLifecycleOutcome::Unchanged {
                        document,
                        reason: UNCHANGED_GENERATION_BLOCKED.to_string(),
                    });
                }
                if self.source_still_due(&recurring.id, observed_local).await? {
                    let document = self.get_document(&recurring.id).await?;
                    return Ok(RecurringLifecycleOutcome::Unchanged {
                        document,
                        reason: UNCHANGED_GENERATION_BLOCKED.to_string(),
                    });
                }
            }
        }

        // Catch-up may advance revision via fulfillments; commit against the
        // post-catch-up revision while the initial check still rejected stale clients.
        let current = self
            .repository
            .get_recurring_transaction(&update.recurring_transaction_id)
            .await?;
        if !transition_allowed(current.lifecycle, command) {
            if current.lifecycle == command.target_lifecycle() {
                let document = self.get_document(&current.id).await?;
                return Ok(RecurringLifecycleOutcome::AlreadyApplied { document });
            }
            let document = self.get_document(&current.id).await?;
            return Ok(RecurringLifecycleOutcome::Unchanged {
                document,
                reason: UNCHANGED_INVALID_TRANSITION.to_string(),
            });
        }
        let commit = RecurringLifecycleUpdate {
            recurring_transaction_id: update.recurring_transaction_id.clone(),
            expected_revision: current.revision,
        };

        self.repository
            .apply_lifecycle_command(command, commit, observed_local)
            .await?;

        if command == RecurringLifecycleCommand::Tombstone {
            self.request_processing_wake();
            return Ok(RecurringLifecycleOutcome::Succeeded {
                document: self
                    .compose_tombstone_ack(&update.recurring_transaction_id)
                    .await?,
            });
        }

        let document = self.get_document(&update.recurring_transaction_id).await?;
        if matches!(
            command,
            RecurringLifecycleCommand::Resume | RecurringLifecycleCommand::Pause
        ) {
            self.request_processing_wake();
        }
        Ok(RecurringLifecycleOutcome::Succeeded { document })
    }

    async fn catch_up_through_observation(
        &self,
        observed_local: chrono::NaiveDateTime,
    ) -> Result<()> {
        loop {
            let outcome = self
                .process_due(observed_local, ProcessingWorkBudget::default_slice(), None)
                .await?;
            match outcome.stop_reason {
                ProcessingStopReason::CaughtUp => return Ok(()),
                ProcessingStopReason::BudgetExhausted => continue,
                ProcessingStopReason::TransientlyDelayed => {
                    return Err(Error::Repository(
                        "Recurring catch-up delayed by database contention".to_string(),
                    ));
                }
                ProcessingStopReason::Cancelled => {
                    return Err(Error::Repository(
                        "Recurring catch-up cancelled before lifecycle commit".to_string(),
                    ));
                }
            }
        }
    }

    async fn source_generation_blocked(&self, recurring_transaction_id: &str) -> Result<bool> {
        Ok(self
            .repository
            .find_unresolved_failure(recurring_transaction_id)
            .await?
            .is_some_and(|failure| failure.repaired_at.is_none()))
    }

    async fn source_still_due(
        &self,
        recurring_transaction_id: &str,
        observed_local: chrono::NaiveDateTime,
    ) -> Result<bool> {
        let Some(head) = self
            .repository
            .get_occurrence_head(recurring_transaction_id)
            .await?
        else {
            return Ok(false);
        };
        Ok(head.next_scheduled_local <= observed_local)
    }

    async fn compose_tombstone_ack(
        &self,
        recurring_transaction_id: &str,
    ) -> Result<super::document::RecurringTransactionDocument> {
        // Tombstones are invisible to get_document; return a minimal post-commit
        // document assembled from retained rows for the command outcome only.
        let recurring = self
            .repository
            .get_recurring_transaction(recurring_transaction_id)
            .await?;
        let schedule = self
            .repository
            .find_open_schedule_revision(recurring_transaction_id)
            .await?
            .ok_or_else(|| {
                Error::Repository(format!(
                    "Missing schedule revision for recurring transaction {recurring_transaction_id}"
                ))
            })?;
        let template = self
            .repository
            .find_open_template_revision(recurring_transaction_id)
            .await?
            .ok_or_else(|| {
                Error::Repository(format!(
                    "Missing template revision for recurring transaction {recurring_transaction_id}"
                ))
            })?;
        Ok(super::document::RecurringTransactionDocument {
            occurrence_summary: super::document::occurrence_summary(&recurring, None, false),
            links: super::document::links_section(
                self.repository
                    .list_occurrences(recurring_transaction_id, 1, None)
                    .await
                    .unwrap_or_else(|_| super::document::empty_occurrence_page()),
            ),
            failures: super::document::failures_section(
                None,
                super::document::empty_failure_page(),
            ),
            budget_impact: super::document::budget_impact_unavailable(),
            recurring_transaction: recurring,
            schedule,
            template,
            head: None,
        })
    }
}
