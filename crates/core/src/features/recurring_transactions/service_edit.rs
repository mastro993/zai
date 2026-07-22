use super::adopt::AdoptRecurringTransaction;
use super::create::normalize_template_description;
use super::document::RecurringAdoptOutcome;
use super::edit::{
    RecurringMutationOutcome, UNCHANGED_GENERATION_BLOCKED, UNCHANGED_NOT_EDITABLE,
    UNCHANGED_SAME_VALUE, UpdateRecurringTransaction, configuration_edit_allowed,
};
use super::lifecycle::description_edit_allowed;
use super::models::{
    RecurringLifecycle, RecurringScheduleRevision, RecurringTemplateRevision, RecurringTransaction,
};
use super::process::ProcessingWorkBudget;
use super::schedule::scheduled_local_at;
use super::service::RecurringTransactionsService;
use super::traits::{RecurringOccurrenceProcessor, RecurringTransactionsServiceTrait};
use crate::{Error, Result};

impl RecurringTransactionsService {
    pub(super) async fn update_inner(
        &self,
        mut input: UpdateRecurringTransaction,
    ) -> Result<RecurringMutationOutcome> {
        input.validate_revision()?;
        input.template.description = normalize_template_description(&input.template.description);
        input.validate_template()?;

        let observed_local = self.clock.sample();
        let recurring = self
            .repository
            .get_recurring_transaction(&input.recurring_transaction_id)
            .await?;
        self.ensure_visible(&recurring)?;
        input.validate_count(recurring.fulfilled_count)?;

        let generation_blocked = self
            .repository
            .find_unresolved_failure(&recurring.id)
            .await?
            .is_some();
        let config_allowed = configuration_edit_allowed(recurring.lifecycle, generation_blocked);
        let rename_allowed = description_edit_allowed(recurring.lifecycle);

        let open_schedule = self.require_open_schedule(&recurring.id).await?;
        let open_template = self.require_open_template(&recurring.id).await?;
        let head = self.repository.get_occurrence_head(&recurring.id).await?;

        let current_next = head
            .as_ref()
            .map(|value| value.next_scheduled_local)
            .unwrap_or(open_schedule.first_scheduled_local);
        let same_schedule = open_schedule.rule == input.schedule
            && open_schedule.effective_until_local.is_none()
            && current_next == input.next_scheduled_local;
        let schedule_changed = !same_schedule;
        let description_changed = normalize_template_description(&open_template.description)
            != normalize_template_description(&input.template.description);
        let non_description_template_changed = open_template.amount != input.template.amount
            || open_template.transaction_type != input.template.transaction_type
            || open_template.transaction_category_id != input.template.transaction_category_id
            || open_template.notes != input.template.notes;
        let template_changed = description_changed || non_description_template_changed;
        let count_changed = recurring.total_occurrences != input.total_occurrences;
        let config_changed = schedule_changed || non_description_template_changed || count_changed;
        let any_change = config_changed || description_changed;

        if recurring.revision != input.expected_revision {
            if !any_change {
                let document = self.get_document(&recurring.id).await?;
                return Ok(RecurringMutationOutcome::AlreadyApplied { document });
            }
            return Err(Error::RevisionConflict {
                current_revision: i64::from(recurring.revision),
            });
        }

        if !any_change {
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringMutationOutcome::Unchanged {
                document,
                reason: UNCHANGED_SAME_VALUE.to_string(),
            });
        }

        let apply_schedule = schedule_changed && config_allowed;
        let apply_count = count_changed && config_allowed;
        let apply_template = if config_allowed {
            template_changed
        } else {
            description_changed && rename_allowed && !config_changed
        };

        if (config_changed && !config_allowed) || (description_changed && !rename_allowed) {
            let reason = if generation_blocked
                && matches!(
                    recurring.lifecycle,
                    RecurringLifecycle::Active | RecurringLifecycle::Paused
                ) {
                UNCHANGED_GENERATION_BLOCKED
            } else {
                UNCHANGED_NOT_EDITABLE
            };
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringMutationOutcome::Unchanged {
                document,
                reason: reason.to_string(),
            });
        }

        if !apply_schedule && !apply_template && !apply_count {
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringMutationOutcome::Unchanged {
                document,
                reason: UNCHANGED_NOT_EDITABLE.to_string(),
            });
        }

        if apply_schedule {
            let earliest_allowed_next = head
                .as_ref()
                .map(|value| value.next_scheduled_local)
                .unwrap_or(observed_local);
            input.validate_schedule(observed_local, earliest_allowed_next)?;
            let _ = scheduled_local_at(&input.schedule, input.next_scheduled_local, 1)?;
        }

        self.repository
            .update_recurring_transaction(
                input.clone(),
                observed_local,
                apply_schedule,
                apply_template,
                apply_count,
            )
            .await?;

        let document = self.get_document(&recurring.id).await?;
        if apply_schedule || apply_count {
            self.request_processing_wake();
        }
        Ok(RecurringMutationOutcome::Succeeded { document })
    }

    fn ensure_visible(&self, recurring: &RecurringTransaction) -> Result<()> {
        if recurring.lifecycle == RecurringLifecycle::Tombstoned || recurring.deleted_at.is_some() {
            return Err(Error::NotFound(format!(
                "Recurring transaction {} not found",
                recurring.id
            )));
        }
        Ok(())
    }

    async fn require_open_schedule(&self, id: &str) -> Result<RecurringScheduleRevision> {
        self.repository
            .find_open_schedule_revision(id)
            .await?
            .ok_or_else(|| {
                Error::Repository(format!(
                    "Missing schedule revision for recurring transaction {id}"
                ))
            })
    }

    async fn require_open_template(&self, id: &str) -> Result<RecurringTemplateRevision> {
        self.repository
            .find_open_template_revision(id)
            .await?
            .ok_or_else(|| {
                Error::Repository(format!(
                    "Missing template revision for recurring transaction {id}"
                ))
            })
    }

    pub(super) async fn adopt_inner(
        &self,
        mut input: AdoptRecurringTransaction,
    ) -> Result<RecurringAdoptOutcome> {
        let observed_local = self.clock.sample();
        input.template.description = normalize_template_description(&input.template.description);
        input.id = Some(Self::assign_id(input.id)?);
        input.validate_inputs()?;

        let created = self
            .repository
            .adopt_existing_transaction(input, observed_local)
            .await?;

        let _catch_up = self
            .process_due(observed_local, ProcessingWorkBudget::default_slice(), None)
            .await?;
        self.request_processing_wake();

        let document = self
            .compose_document(
                self.repository
                    .get_recurring_transaction(&created.id)
                    .await?,
            )
            .await?;
        Ok(RecurringAdoptOutcome::Succeeded { document })
    }
}
