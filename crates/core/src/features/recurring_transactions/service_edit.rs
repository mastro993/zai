use super::create::{RecurringTemplateInput, normalize_recurring_name};
use super::edit::{
    EditRecurringCount, EditRecurringSchedule, EditRecurringTemplate, RecurringMutationOutcome,
    RenameRecurringTransaction, UNCHANGED_GENERATION_BLOCKED, UNCHANGED_NOT_EDITABLE,
    UNCHANGED_SAME_VALUE, configuration_edit_allowed, rename_allowed,
};
use super::models::{
    RecurringLifecycle, RecurringScheduleRevision, RecurringTemplateRevision, RecurringTransaction,
};
use super::schedule::scheduled_local_at;
use super::service::RecurringTransactionsService;
use super::traits::RecurringTransactionsServiceTrait;
use crate::{Error, Result};

impl RecurringTransactionsService {
    pub(super) async fn rename_inner(
        &self,
        input: RenameRecurringTransaction,
    ) -> Result<RecurringMutationOutcome> {
        let name = input.validate()?;
        let recurring = self
            .repository
            .get_recurring_transaction(&input.recurring_transaction_id)
            .await?;

        if recurring.lifecycle == RecurringLifecycle::Tombstoned || recurring.deleted_at.is_some() {
            return Err(Error::NotFound(format!(
                "Recurring transaction {} not found",
                recurring.id
            )));
        }
        if !rename_allowed(recurring.lifecycle) {
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringMutationOutcome::Unchanged {
                document,
                reason: UNCHANGED_NOT_EDITABLE.to_string(),
            });
        }

        if recurring.revision != input.expected_revision {
            if names_equal(&recurring.name, &name) {
                let document = self.get_document(&recurring.id).await?;
                return Ok(RecurringMutationOutcome::AlreadyApplied { document });
            }
            return Err(Error::RevisionConflict {
                current_revision: i64::from(recurring.revision),
            });
        }

        if names_equal(&recurring.name, &name) {
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringMutationOutcome::Unchanged {
                document,
                reason: UNCHANGED_SAME_VALUE.to_string(),
            });
        }

        self.repository
            .rename_recurring_transaction(recurring.id.clone(), input.expected_revision, name)
            .await?;
        let document = self.get_document(&recurring.id).await?;
        Ok(RecurringMutationOutcome::Succeeded { document })
    }

    pub(super) async fn edit_schedule_inner(
        &self,
        input: EditRecurringSchedule,
    ) -> Result<RecurringMutationOutcome> {
        let observed_local = self.clock.sample();
        input.validate(observed_local)?;
        let recurring = self
            .repository
            .get_recurring_transaction(&input.recurring_transaction_id)
            .await?;
        self.ensure_visible(&recurring)?;

        let generation_blocked = self
            .repository
            .find_unresolved_failure(&recurring.id)
            .await?
            .is_some();
        if !configuration_edit_allowed(recurring.lifecycle, generation_blocked) {
            return self
                .unchanged_or_conflict(
                    &recurring,
                    input.expected_revision,
                    UNCHANGED_NOT_EDITABLE,
                    generation_blocked,
                )
                .await;
        }

        let open = self.require_open_schedule(&recurring.id).await?;
        let same_schedule = open.rule == input.schedule
            && open.first_scheduled_local == input.next_scheduled_local
            && open.effective_until_local.is_none();

        if recurring.revision != input.expected_revision {
            if same_schedule {
                let document = self.get_document(&recurring.id).await?;
                return Ok(RecurringMutationOutcome::AlreadyApplied { document });
            }
            return Err(Error::RevisionConflict {
                current_revision: i64::from(recurring.revision),
            });
        }

        if same_schedule {
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringMutationOutcome::Unchanged {
                document,
                reason: UNCHANGED_SAME_VALUE.to_string(),
            });
        }

        let _ = scheduled_local_at(&input.schedule, input.next_scheduled_local, 1)?;
        self.repository
            .edit_recurring_schedule(input.clone())
            .await?;
        let document = self.get_document(&recurring.id).await?;
        Ok(RecurringMutationOutcome::Succeeded { document })
    }

    pub(super) async fn edit_template_inner(
        &self,
        input: EditRecurringTemplate,
    ) -> Result<RecurringMutationOutcome> {
        input.validate()?;
        let observed_local = self.clock.sample();
        let recurring = self
            .repository
            .get_recurring_transaction(&input.recurring_transaction_id)
            .await?;
        self.ensure_visible(&recurring)?;

        let generation_blocked = self
            .repository
            .find_unresolved_failure(&recurring.id)
            .await?
            .is_some();
        if !configuration_edit_allowed(recurring.lifecycle, generation_blocked) {
            return self
                .unchanged_or_conflict(
                    &recurring,
                    input.expected_revision,
                    UNCHANGED_NOT_EDITABLE,
                    generation_blocked,
                )
                .await;
        }

        let open = self.require_open_template(&recurring.id).await?;
        let same_template = templates_equal(&open, &input.template);

        if recurring.revision != input.expected_revision {
            if same_template {
                let document = self.get_document(&recurring.id).await?;
                return Ok(RecurringMutationOutcome::AlreadyApplied { document });
            }
            return Err(Error::RevisionConflict {
                current_revision: i64::from(recurring.revision),
            });
        }

        if same_template {
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringMutationOutcome::Unchanged {
                document,
                reason: UNCHANGED_SAME_VALUE.to_string(),
            });
        }

        self.repository
            .edit_recurring_template(input, observed_local)
            .await?;
        let document = self.get_document(&recurring.id).await?;
        Ok(RecurringMutationOutcome::Succeeded { document })
    }

    pub(super) async fn edit_count_inner(
        &self,
        input: EditRecurringCount,
    ) -> Result<RecurringMutationOutcome> {
        let recurring = self
            .repository
            .get_recurring_transaction(&input.recurring_transaction_id)
            .await?;
        self.ensure_visible(&recurring)?;
        input.validate(recurring.fulfilled_count)?;

        let generation_blocked = self
            .repository
            .find_unresolved_failure(&recurring.id)
            .await?
            .is_some();
        if !configuration_edit_allowed(recurring.lifecycle, generation_blocked) {
            return self
                .unchanged_or_conflict(
                    &recurring,
                    input.expected_revision,
                    UNCHANGED_NOT_EDITABLE,
                    generation_blocked,
                )
                .await;
        }

        let same_count = recurring.total_occurrences == input.total_occurrences;
        if recurring.revision != input.expected_revision {
            if same_count {
                let document = self.get_document(&recurring.id).await?;
                return Ok(RecurringMutationOutcome::AlreadyApplied { document });
            }
            return Err(Error::RevisionConflict {
                current_revision: i64::from(recurring.revision),
            });
        }

        if same_count {
            let document = self.get_document(&recurring.id).await?;
            return Ok(RecurringMutationOutcome::Unchanged {
                document,
                reason: UNCHANGED_SAME_VALUE.to_string(),
            });
        }

        self.repository.edit_recurring_count(input).await?;
        let document = self.get_document(&recurring.id).await?;
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

    async fn unchanged_or_conflict(
        &self,
        recurring: &RecurringTransaction,
        expected_revision: i32,
        not_editable_reason: &str,
        generation_blocked: bool,
    ) -> Result<RecurringMutationOutcome> {
        if recurring.revision != expected_revision {
            return Err(Error::RevisionConflict {
                current_revision: i64::from(recurring.revision),
            });
        }
        let reason = if generation_blocked
            && matches!(
                recurring.lifecycle,
                RecurringLifecycle::Active | RecurringLifecycle::Paused
            ) {
            UNCHANGED_GENERATION_BLOCKED
        } else {
            not_editable_reason
        };
        let document = self.get_document(&recurring.id).await?;
        Ok(RecurringMutationOutcome::Unchanged {
            document,
            reason: reason.to_string(),
        })
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
}

fn names_equal(current: &str, next: &str) -> bool {
    normalize_recurring_name(current) == normalize_recurring_name(next)
}

fn templates_equal(open: &RecurringTemplateRevision, input: &RecurringTemplateInput) -> bool {
    open.description == input.description
        && open.amount == input.amount
        && open.transaction_type == input.transaction_type
        && open.transaction_category_id == input.transaction_category_id
        && open.notes == input.notes
}
