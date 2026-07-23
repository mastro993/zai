use super::bulk::{
    BulkEligibility, NEXT_ACTION_REPAIR, NEXT_ACTION_RETRY, RecurringBulkAction,
    RecurringBulkExecuteResult, RecurringBulkItem, RecurringBulkItemOutcomeKind,
    RecurringBulkItemResult, RecurringBulkLifecycleCounts, RecurringBulkPreflight,
    RecurringBulkRequest, RecurringBulkUnchangedItem, RecurringMatchingIds, UNCHANGED_NOT_FOUND,
    UNCHANGED_REVISION_CONFLICT, classify_lifecycle_eligibility, classify_retry_eligibility,
    count_due_from_head, record_lifecycle,
};
use super::edit::UNCHANGED_GENERATION_BLOCKED;
use super::lifecycle::{RecurringLifecycleOutcome, RecurringLifecycleUpdate};
use super::models::RecurringFeedFilters;
use super::models::RecurringLifecycle;
use super::repair::{
    RecurringRecoveryAction, RecurringRecoveryOutcome, RetryRecurringGenerationFailure,
    UNCHANGED_REPAIR_REQUIRED, recovery_action_for_failure,
};
use super::service::RecurringTransactionsService;
use crate::{Error, Result};

impl RecurringTransactionsService {
    pub(super) async fn list_matching_ids_inner(
        &self,
        filters: RecurringFeedFilters,
    ) -> Result<RecurringMatchingIds> {
        let filters = filters.normalized()?;
        let items = self
            .repository
            .list_matching_ids_filtered(filters.clone())
            .await?;
        Ok(RecurringMatchingIds {
            fingerprint: filters.fingerprint(),
            items,
        })
    }

    pub(super) async fn preflight_bulk_inner(
        &self,
        request: RecurringBulkRequest,
    ) -> Result<RecurringBulkPreflight> {
        request.validate_bound()?;
        let observed_local = self.clock.sample();
        let mut lifecycle = RecurringBulkLifecycleCounts::default();
        let mut eligible_items = Vec::new();
        let mut unchanged_items = Vec::new();
        let mut due_catch_up = 0_i32;
        let mut waiting = 0_i32;
        let mut repair_needed = 0_i32;
        let mut needs_attention = 0_i32;

        for item in &request.items {
            let recurring = match self
                .repository
                .get_recurring_transaction(&item.recurring_transaction_id)
                .await
            {
                Ok(recurring) => recurring,
                Err(Error::NotFound(_)) => {
                    unchanged_items.push(RecurringBulkUnchangedItem {
                        recurring_transaction_id: item.recurring_transaction_id.clone(),
                        reason: UNCHANGED_NOT_FOUND.to_string(),
                        next_action: None,
                    });
                    continue;
                }
                Err(error) => return Err(error),
            };

            if recurring.lifecycle == RecurringLifecycle::Tombstoned
                || recurring.deleted_at.is_some()
            {
                unchanged_items.push(RecurringBulkUnchangedItem {
                    recurring_transaction_id: item.recurring_transaction_id.clone(),
                    reason: UNCHANGED_NOT_FOUND.to_string(),
                    next_action: None,
                });
                continue;
            }

            record_lifecycle(&mut lifecycle, recurring.lifecycle);
            if recurring.revision != item.expected_revision {
                unchanged_items.push(RecurringBulkUnchangedItem {
                    recurring_transaction_id: item.recurring_transaction_id.clone(),
                    reason: UNCHANGED_REVISION_CONFLICT.to_string(),
                    next_action: None,
                });
                continue;
            }
            let unresolved = self
                .repository
                .find_unresolved_failure(&recurring.id)
                .await?;
            let generation_blocked = unresolved
                .as_ref()
                .is_some_and(|failure| failure.repaired_at.is_none());
            if generation_blocked {
                needs_attention += 1;
            }

            let eligibility = if request.action.is_retry() {
                classify_retry_eligibility(
                    unresolved.is_some(),
                    unresolved
                        .as_ref()
                        .filter(|failure| failure.repaired_at.is_none())
                        .and_then(|failure| failure.repair_field_key),
                )
            } else {
                let command = request
                    .action
                    .as_lifecycle_command()
                    .expect("lifecycle action");
                classify_lifecycle_eligibility(recurring.lifecycle, generation_blocked, command)
            };

            match eligibility {
                BulkEligibility::Eligible => {
                    if request.action.requires_catch_up()
                        && recurring.lifecycle == RecurringLifecycle::Active
                        && let Some(head) =
                            self.repository.get_occurrence_head(&recurring.id).await?
                        && let Some(schedule) = self
                            .repository
                            .find_open_schedule_revision(&recurring.id)
                            .await?
                    {
                        due_catch_up += count_due_from_head(
                            &schedule.rule,
                            schedule.first_scheduled_local,
                            head.next_ordinal,
                            recurring.total_occurrences,
                            observed_local,
                        )?;
                    }
                    if request.action.is_retry()
                        && let Some(failure) = unresolved.as_ref()
                    {
                        waiting += self
                            .waiting_count_for_failure(
                                &recurring.id,
                                failure.ordinal,
                                recurring.total_occurrences,
                            )
                            .await?;
                    }
                    eligible_items.push(item.clone());
                }
                BulkEligibility::Unchanged {
                    reason,
                    next_action,
                } => {
                    if next_action == Some(NEXT_ACTION_REPAIR) {
                        repair_needed += 1;
                    }
                    unchanged_items.push(RecurringBulkUnchangedItem {
                        recurring_transaction_id: item.recurring_transaction_id.clone(),
                        reason: reason.to_string(),
                        next_action: next_action.map(str::to_string),
                    });
                }
            }
        }

        lifecycle.needs_attention = needs_attention;
        Ok(RecurringBulkPreflight {
            selected: request.items.len() as i32,
            eligible: eligible_items.len() as i32,
            unchanged: unchanged_items.len() as i32,
            lifecycle,
            due_catch_up,
            waiting,
            repair_needed,
            eligible_items,
            unchanged_items,
        })
    }

    pub(super) async fn execute_bulk_inner(
        &self,
        request: RecurringBulkRequest,
    ) -> Result<RecurringBulkExecuteResult> {
        request.validate_bound()?;
        let mut results = Vec::with_capacity(request.items.len());
        let mut succeeded = 0_i32;
        let mut unchanged = 0_i32;
        let mut failed = 0_i32;

        for item in request.items {
            let result = self.execute_one_bulk_item(request.action, item).await;
            match result.outcome {
                RecurringBulkItemOutcomeKind::Succeeded => succeeded += 1,
                RecurringBulkItemOutcomeKind::Unchanged => unchanged += 1,
                RecurringBulkItemOutcomeKind::Failed => failed += 1,
            }
            results.push(result);
        }

        Ok(RecurringBulkExecuteResult {
            results,
            succeeded,
            unchanged,
            failed,
        })
    }

    async fn execute_one_bulk_item(
        &self,
        action: RecurringBulkAction,
        item: RecurringBulkItem,
    ) -> RecurringBulkItemResult {
        let id = item.recurring_transaction_id.clone();
        if action.is_retry() {
            return self.map_retry_outcome(id, item).await;
        }
        let command = action.as_lifecycle_command().expect("lifecycle action");
        let update = RecurringLifecycleUpdate {
            recurring_transaction_id: item.recurring_transaction_id,
            expected_revision: item.expected_revision,
        };
        match self.apply_lifecycle(command, update).await {
            Ok(RecurringLifecycleOutcome::Succeeded { .. }) => RecurringBulkItemResult {
                recurring_transaction_id: id,
                outcome: RecurringBulkItemOutcomeKind::Succeeded,
                reason: None,
                next_action: None,
            },
            Ok(RecurringLifecycleOutcome::AlreadyApplied { .. }) => RecurringBulkItemResult {
                recurring_transaction_id: id,
                outcome: RecurringBulkItemOutcomeKind::Unchanged,
                reason: Some("already_applied".to_string()),
                next_action: None,
            },
            Ok(RecurringLifecycleOutcome::Unchanged { reason, .. }) => {
                let next_action = if reason == UNCHANGED_GENERATION_BLOCKED {
                    Some(NEXT_ACTION_REPAIR.to_string())
                } else {
                    None
                };
                RecurringBulkItemResult {
                    recurring_transaction_id: id,
                    outcome: RecurringBulkItemOutcomeKind::Unchanged,
                    reason: Some(reason),
                    next_action,
                }
            }
            Err(Error::RevisionConflict { .. }) => RecurringBulkItemResult {
                recurring_transaction_id: id,
                outcome: RecurringBulkItemOutcomeKind::Unchanged,
                reason: Some(UNCHANGED_REVISION_CONFLICT.to_string()),
                next_action: None,
            },
            Err(Error::NotFound(_)) => RecurringBulkItemResult {
                recurring_transaction_id: id,
                outcome: RecurringBulkItemOutcomeKind::Unchanged,
                reason: Some(UNCHANGED_NOT_FOUND.to_string()),
                next_action: None,
            },
            Err(_) => RecurringBulkItemResult {
                recurring_transaction_id: id,
                outcome: RecurringBulkItemOutcomeKind::Failed,
                reason: Some("operation_failed".to_string()),
                next_action: None,
            },
        }
    }

    async fn map_retry_outcome(
        &self,
        id: String,
        item: RecurringBulkItem,
    ) -> RecurringBulkItemResult {
        let input = RetryRecurringGenerationFailure {
            recurring_transaction_id: item.recurring_transaction_id,
            expected_revision: item.expected_revision,
        };
        match self.retry_generation_inner(input).await {
            Ok(RecurringRecoveryOutcome::Succeeded { .. }) => RecurringBulkItemResult {
                recurring_transaction_id: id,
                outcome: RecurringBulkItemOutcomeKind::Succeeded,
                reason: None,
                next_action: None,
            },
            Ok(RecurringRecoveryOutcome::AlreadyApplied { .. }) => RecurringBulkItemResult {
                recurring_transaction_id: id,
                outcome: RecurringBulkItemOutcomeKind::Unchanged,
                reason: Some("already_applied".to_string()),
                next_action: None,
            },
            Ok(RecurringRecoveryOutcome::Unchanged { reason, document }) => {
                let next_action = if reason == UNCHANGED_REPAIR_REQUIRED {
                    Some(NEXT_ACTION_REPAIR.to_string())
                } else if document.occurrence_summary.needs_attention {
                    let recovery_action = document.failures.unresolved.as_ref().map_or(
                        RecurringRecoveryAction::CopyDiagnostics,
                        |failure| {
                            if failure.repaired_at.is_some() {
                                RecurringRecoveryAction::Retry
                            } else {
                                recovery_action_for_failure(failure.repair_field_key)
                            }
                        },
                    );
                    match recovery_action {
                        RecurringRecoveryAction::Repair => Some(NEXT_ACTION_REPAIR.to_string()),
                        RecurringRecoveryAction::Retry => Some(NEXT_ACTION_RETRY.to_string()),
                        RecurringRecoveryAction::CopyDiagnostics => None,
                    }
                } else {
                    None
                };
                RecurringBulkItemResult {
                    recurring_transaction_id: id,
                    outcome: RecurringBulkItemOutcomeKind::Unchanged,
                    reason: Some(reason),
                    next_action,
                }
            }
            Err(Error::RevisionConflict { .. }) => RecurringBulkItemResult {
                recurring_transaction_id: id,
                outcome: RecurringBulkItemOutcomeKind::Unchanged,
                reason: Some(UNCHANGED_REVISION_CONFLICT.to_string()),
                next_action: None,
            },
            Err(Error::NotFound(_)) => RecurringBulkItemResult {
                recurring_transaction_id: id,
                outcome: RecurringBulkItemOutcomeKind::Unchanged,
                reason: Some(UNCHANGED_NOT_FOUND.to_string()),
                next_action: None,
            },
            Err(_) => RecurringBulkItemResult {
                recurring_transaction_id: id,
                outcome: RecurringBulkItemOutcomeKind::Failed,
                reason: Some("operation_failed".to_string()),
                next_action: None,
            },
        }
    }
}
