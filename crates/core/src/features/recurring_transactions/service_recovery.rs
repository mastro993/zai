use super::create::normalize_template_description;
use super::models::{
    DEFAULT_FAILURE_LIMIT, MAX_FAILURE_LIMIT, RecurringFailurePage, RecurringLifecycle,
    RecurringTransaction,
};
use super::process::ProcessingWorkBudget;
use super::repair::{
    GenerationFailureDiagnostics, PreviewRecurringGenerationRepair, RecurringRecoveryAction,
    RecurringRecoveryOutcome, RecurringRepairPreview, RepairRecurringGenerationFailure,
    RetryRecurringGenerationFailure, UNCHANGED_ALREADY_REPAIRED, UNCHANGED_NO_OPEN_FAILURE,
    UNCHANGED_REPAIR_NOT_APPLICABLE, UNCHANGED_REPAIR_REQUIRED, count_waiting_due_behind,
    diagnostics_typed_state, recovery_action_for_failure,
};
use super::service::RecurringTransactionsService;
use super::traits::{RecurringOccurrenceProcessor, RecurringTransactionsServiceTrait};
use crate::{Error, Result};

impl RecurringTransactionsService {
    pub(super) async fn waiting_count_for_failure(
        &self,
        recurring_transaction_id: &str,
        failed_ordinal: i32,
        total_occurrences: Option<i32>,
    ) -> Result<i32> {
        let observed_local = self.clock.sample();
        let Some(schedule) = self
            .repository
            .find_open_schedule_revision(recurring_transaction_id)
            .await?
        else {
            return Ok(0);
        };
        count_waiting_due_behind(
            &schedule.rule,
            schedule.first_scheduled_local,
            failed_ordinal,
            total_occurrences,
            observed_local,
        )
    }

    async fn invoke_ordered_retry(&self) -> Result<()> {
        let observed_local = self.clock.sample();
        let _ = self
            .process_due(observed_local, ProcessingWorkBudget::default_slice(), None)
            .await?;
        self.request_processing_wake();
        Ok(())
    }

    fn ensure_visible_for_recovery(&self, recurring: &RecurringTransaction) -> Result<()> {
        if recurring.lifecycle == RecurringLifecycle::Tombstoned || recurring.deleted_at.is_some() {
            return Err(Error::NotFound(format!(
                "Recurring transaction {} not found",
                recurring.id
            )));
        }
        Ok(())
    }

    pub(super) async fn preview_generation_repair_inner(
        &self,
        input: PreviewRecurringGenerationRepair,
    ) -> Result<RecurringRepairPreview> {
        input.validate_field_key()?;
        input.validate_template()?;
        let recurring = self
            .repository
            .get_recurring_transaction(&input.recurring_transaction_id)
            .await?;
        self.ensure_visible_for_recovery(&recurring)?;
        let failure = self
            .repository
            .find_unresolved_failure(&recurring.id)
            .await?
            .ok_or_else(|| {
                Error::InvalidData("No open generation failure to repair".to_string())
            })?;
        if failure.repair_field_key.as_deref() != Some(input.repair_field_key.as_str()) {
            return Err(Error::InvalidData(
                "Repair field does not match the open failure".to_string(),
            ));
        }
        let (affected_unfulfilled_segment_count, includes_future_template) = self
            .repository
            .preview_generation_repair(&recurring.id)
            .await?;
        Ok(RecurringRepairPreview {
            repair_field_key: input.repair_field_key,
            affected_unfulfilled_segment_count,
            includes_future_template,
            next_action: RecurringRecoveryAction::Repair,
        })
    }

    pub(super) async fn repair_and_retry_inner(
        &self,
        mut input: RepairRecurringGenerationFailure,
    ) -> Result<RecurringRecoveryOutcome> {
        input.validate_revision()?;
        input.validate_field_key()?;
        input.template.description = normalize_template_description(&input.template.description);
        input.validate_template()?;

        let recurring = self
            .repository
            .get_recurring_transaction(&input.recurring_transaction_id)
            .await?;
        self.ensure_visible_for_recovery(&recurring)?;

        let failure = self
            .repository
            .find_unresolved_failure(&recurring.id)
            .await?;
        let Some(failure) = failure else {
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringRecoveryOutcome::Unchanged {
                document,
                reason: UNCHANGED_NO_OPEN_FAILURE.to_string(),
            });
        };

        if failure.repaired_at.is_some() {
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringRecoveryOutcome::Unchanged {
                document,
                reason: UNCHANGED_ALREADY_REPAIRED.to_string(),
            });
        }

        if failure.repair_field_key.as_deref() != Some(input.repair_field_key.as_str()) {
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringRecoveryOutcome::Unchanged {
                document,
                reason: UNCHANGED_REPAIR_NOT_APPLICABLE.to_string(),
            });
        }

        if recurring.revision != input.expected_revision {
            return Err(Error::RevisionConflict {
                current_revision: i64::from(recurring.revision),
            });
        }

        self.repository
            .apply_generation_repair(
                input.recurring_transaction_id.clone(),
                input.expected_revision,
                input.repair_field_key.clone(),
                input.template.clone(),
            )
            .await?;

        // Repair is already durable; ordered retry may still park on an unrelated
        // failure. Surface operational retry errors, then always return post-repair state.
        if let Err(error) = self.invoke_ordered_retry().await {
            if !matches!(error, Error::Repository(_)) {
                return Err(error);
            }
        }
        let document = self.get_document(&input.recurring_transaction_id).await?;
        Ok(RecurringRecoveryOutcome::Succeeded { document })
    }

    pub(super) async fn retry_generation_inner(
        &self,
        input: RetryRecurringGenerationFailure,
    ) -> Result<RecurringRecoveryOutcome> {
        input.validate_revision()?;
        let recurring = self
            .repository
            .get_recurring_transaction(&input.recurring_transaction_id)
            .await?;
        self.ensure_visible_for_recovery(&recurring)?;

        let failure = self
            .repository
            .find_unresolved_failure(&recurring.id)
            .await?;
        let Some(failure) = failure else {
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringRecoveryOutcome::Unchanged {
                document,
                reason: UNCHANGED_NO_OPEN_FAILURE.to_string(),
            });
        };

        if recovery_action_for_failure(failure.repair_field_key.as_deref())
            == RecurringRecoveryAction::Repair
            && failure.repaired_at.is_none()
        {
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringRecoveryOutcome::Unchanged {
                document,
                reason: UNCHANGED_REPAIR_REQUIRED.to_string(),
            });
        }

        if recurring.revision != input.expected_revision {
            if failure.repaired_at.is_some() {
                let document = self.get_document(&recurring.id).await?;
                return Ok(RecurringRecoveryOutcome::AlreadyApplied { document });
            }
            return Err(Error::RevisionConflict {
                current_revision: i64::from(recurring.revision),
            });
        }

        if let Err(error) = self.invoke_ordered_retry().await {
            if !matches!(error, Error::Repository(_)) {
                return Err(error);
            }
        }
        let document = self.get_document(&recurring.id).await?;
        Ok(RecurringRecoveryOutcome::Succeeded { document })
    }

    pub(super) async fn generation_failure_diagnostics_inner(
        &self,
        recurring_transaction_id: &str,
    ) -> Result<GenerationFailureDiagnostics> {
        let recurring = self
            .repository
            .get_recurring_transaction(recurring_transaction_id)
            .await?;
        self.ensure_visible_for_recovery(&recurring)?;
        let failure = self
            .repository
            .find_unresolved_failure(recurring_transaction_id)
            .await?
            .ok_or_else(|| {
                Error::InvalidData("No open generation failure for diagnostics".to_string())
            })?;
        let schema_version = self.repository.current_schema_version().await?;
        Ok(GenerationFailureDiagnostics {
            error_code: failure.error_code,
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            schema_version,
            first_failed_at: failure.first_failed_at,
            last_failed_at: failure.last_failed_at,
            typed_state: diagnostics_typed_state().to_string(),
            correlation_id: failure.correlation_id,
        })
    }

    pub(super) async fn list_failure_history_inner(
        &self,
        recurring_transaction_id: &str,
        limit: Option<i64>,
        cursor: Option<String>,
    ) -> Result<RecurringFailurePage> {
        let recurring = self
            .repository
            .get_recurring_transaction(recurring_transaction_id)
            .await?;
        self.ensure_visible_for_recovery(&recurring)?;
        let limit = limit
            .unwrap_or(DEFAULT_FAILURE_LIMIT)
            .clamp(1, MAX_FAILURE_LIMIT);
        self.repository
            .list_failure_history(recurring_transaction_id, limit, cursor)
            .await
    }
}
