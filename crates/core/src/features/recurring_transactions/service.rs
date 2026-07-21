use super::adopt::{
    AdoptRecurringTransaction, AdoptionPreview, AdoptionPreviewRequest, count_later_due_occurrences,
};
use super::create::{NewRecurringTransaction, normalize_recurring_name};
use super::document::{
    RecurringAdoptOutcome, RecurringCreateOutcome, RecurringFeedItem, RecurringFeedResult,
    RecurringTransactionDocument, TransactionRecurringProvenance, budget_impact_unavailable,
    failures_section, links_section, occurrence_summary, visible_source_link,
};
use super::models::{
    DEFAULT_FAILURE_LIMIT, DEFAULT_FEED_LIMIT, MAX_FEED_LIMIT, RecurringLifecycle,
    RecurringOccurrencePage, RecurringTransaction,
};
use super::process::{
    ProcessOneOutcome, ProcessingSliceOutcome, ProcessingStopReason, ProcessingWorkBudget,
};
use super::schedule::scheduled_local_at;
use super::traits::{
    RecurringOccurrenceProcessor, RecurringTransactionsRepositoryTrait,
    RecurringTransactionsServiceTrait,
};
use crate::features::budgets::traits::CalendarClock;
use crate::{Error, Result};
use std::sync::Arc;
use uuid::Uuid;

pub struct RecurringTransactionsService {
    repository: Arc<dyn RecurringTransactionsRepositoryTrait>,
    clock: Arc<dyn CalendarClock>,
}

impl RecurringTransactionsService {
    pub fn new(
        repository: Arc<dyn RecurringTransactionsRepositoryTrait>,
        clock: Arc<dyn CalendarClock>,
    ) -> Self {
        Self { repository, clock }
    }

    async fn compose_document(
        &self,
        recurring: RecurringTransaction,
    ) -> Result<RecurringTransactionDocument> {
        if recurring.lifecycle == RecurringLifecycle::Tombstoned || recurring.deleted_at.is_some() {
            return Err(Error::NotFound(format!(
                "Recurring transaction {} not found",
                recurring.id
            )));
        }

        let schedule = self
            .repository
            .find_open_schedule_revision(&recurring.id)
            .await?
            .ok_or_else(|| {
                Error::Repository(format!(
                    "Missing schedule revision for recurring transaction {}",
                    recurring.id
                ))
            })?;
        let template = self
            .repository
            .find_open_template_revision(&recurring.id)
            .await?
            .ok_or_else(|| {
                Error::Repository(format!(
                    "Missing template revision for recurring transaction {}",
                    recurring.id
                ))
            })?;

        let head = self
            .repository
            .get_occurrence_head(&recurring.id)
            .await?
            .filter(|value| value.recurring_transaction_id == recurring.id);

        let unresolved = self
            .repository
            .find_unresolved_failure(&recurring.id)
            .await?;
        let needs_attention = unresolved.is_some();

        let links = self
            .repository
            .list_occurrences(&recurring.id, DEFAULT_FEED_LIMIT, None)
            .await?;
        let history = self
            .repository
            .list_failure_history(&recurring.id, DEFAULT_FAILURE_LIMIT, None)
            .await?;

        Ok(RecurringTransactionDocument {
            occurrence_summary: occurrence_summary(&recurring, head.as_ref(), needs_attention),
            links: links_section(links),
            failures: failures_section(unresolved, history),
            budget_impact: budget_impact_unavailable(),
            recurring_transaction: recurring,
            schedule,
            template,
            head,
        })
    }

    fn assign_id(mut input_id: Option<String>) -> Result<String> {
        match input_id.as_deref().map(str::trim) {
            Some("") => Err(Error::InvalidData(
                "Recurring transaction id cannot be blank".into(),
            )),
            Some(id) => {
                input_id = Some(id.to_string());
                Ok(input_id.expect("id set"))
            }
            None => Ok(Uuid::new_v4().to_string()),
        }
    }
}

#[async_trait::async_trait]
impl RecurringTransactionsServiceTrait for RecurringTransactionsService {
    async fn list_feed(
        &self,
        limit: Option<i64>,
        cursor: Option<String>,
    ) -> Result<RecurringFeedResult> {
        let limit = limit.unwrap_or(DEFAULT_FEED_LIMIT).clamp(1, MAX_FEED_LIMIT);
        let page = self.repository.list_feed(limit, cursor).await?;

        let mut items = Vec::with_capacity(page.items.len());
        for recurring_transaction in page.items {
            let next_scheduled_local = self
                .repository
                .get_occurrence_head(&recurring_transaction.id)
                .await?
                .map(|head| head.next_scheduled_local);
            let needs_attention = self
                .repository
                .find_unresolved_failure(&recurring_transaction.id)
                .await?
                .is_some();
            items.push(RecurringFeedItem {
                recurring_transaction,
                next_scheduled_local,
                needs_attention,
            });
        }

        Ok(RecurringFeedResult {
            items,
            next_cursor: page.next_cursor,
        })
    }

    async fn get_document(&self, id: &str) -> Result<RecurringTransactionDocument> {
        let recurring = self.repository.get_recurring_transaction(id).await?;
        self.compose_document(recurring).await
    }

    async fn list_linked_occurrences(
        &self,
        recurring_transaction_id: &str,
        limit: Option<i64>,
        cursor: Option<String>,
    ) -> Result<RecurringOccurrencePage> {
        let recurring = self
            .repository
            .get_recurring_transaction(recurring_transaction_id)
            .await?;
        if recurring.lifecycle == RecurringLifecycle::Tombstoned || recurring.deleted_at.is_some() {
            return Err(Error::NotFound(format!(
                "Recurring transaction {recurring_transaction_id} not found"
            )));
        }
        let limit = limit.unwrap_or(DEFAULT_FEED_LIMIT).clamp(1, MAX_FEED_LIMIT);
        self.repository
            .list_occurrences(recurring_transaction_id, limit, cursor)
            .await
    }

    async fn get_transaction_provenance(
        &self,
        transaction_id: &str,
    ) -> Result<Option<TransactionRecurringProvenance>> {
        let Some(occurrence) = self
            .repository
            .find_provenance_by_transaction(transaction_id)
            .await?
        else {
            return Ok(None);
        };
        let recurring = self
            .repository
            .get_recurring_transaction(&occurrence.recurring_transaction_id)
            .await?;
        Ok(Some(TransactionRecurringProvenance {
            occurrence,
            source: visible_source_link(&recurring),
        }))
    }

    async fn preview_adoption(&self, input: AdoptionPreviewRequest) -> Result<AdoptionPreview> {
        input.validate_inputs()?;
        let observed_local = self.clock.sample();
        if self
            .repository
            .find_provenance_by_transaction(&input.transaction_id)
            .await?
            .is_some()
        {
            return Err(Error::Conflict(
                "Transaction already has recurring provenance".to_string(),
            ));
        }

        let first_scheduled_local = self
            .repository
            .find_visible_transaction_date(&input.transaction_id)
            .await?;
        let later_due_count = count_later_due_occurrences(
            &input.schedule,
            first_scheduled_local,
            input.total_occurrences,
            observed_local,
        )?;
        Ok(AdoptionPreview {
            transaction_id: input.transaction_id,
            first_scheduled_local,
            later_due_count,
        })
    }

    async fn create(&self, mut input: NewRecurringTransaction) -> Result<RecurringCreateOutcome> {
        let observed_local = self.clock.sample();
        input.name = normalize_recurring_name(&input.name);
        input.id = Some(Self::assign_id(input.id)?);
        input.validate(observed_local)?;

        let first_scheduled_local =
            scheduled_local_at(&input.schedule, input.first_scheduled_local, 1)?;
        input.first_scheduled_local = first_scheduled_local;
        input.validate(observed_local)?;

        let created = self.repository.create_recurring_transaction(input).await?;
        let document = self.compose_document(created).await?;
        Ok(RecurringCreateOutcome::Succeeded { document })
    }

    async fn adopt(&self, mut input: AdoptRecurringTransaction) -> Result<RecurringAdoptOutcome> {
        let observed_local = self.clock.sample();
        input.name = normalize_recurring_name(&input.name);
        input.id = Some(Self::assign_id(input.id)?);
        input.validate_inputs()?;

        let created = self
            .repository
            .adopt_existing_transaction(input, observed_local)
            .await?;

        let _catch_up = self
            .process_due(observed_local, ProcessingWorkBudget::default_slice())
            .await?;

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

#[async_trait::async_trait]
impl RecurringOccurrenceProcessor for RecurringTransactionsService {
    async fn process_due(
        &self,
        observed_local: chrono::NaiveDateTime,
        work_budget: ProcessingWorkBudget,
    ) -> Result<ProcessingSliceOutcome> {
        let max_occurrences = work_budget.max_occurrences.max(1);
        let mut committed = 0_u32;
        let mut already_fulfilled = 0_u32;

        while committed + already_fulfilled < max_occurrences {
            match self
                .repository
                .process_one_due_occurrence(observed_local)
                .await?
            {
                ProcessOneOutcome::Committed(_) => committed += 1,
                ProcessOneOutcome::AlreadyFulfilled(_) => already_fulfilled += 1,
                ProcessOneOutcome::NoEligibleWork => {
                    return Ok(ProcessingSliceOutcome {
                        committed,
                        already_fulfilled,
                        more_due_remaining: false,
                        stop_reason: ProcessingStopReason::CaughtUp,
                        observed_local,
                    });
                }
            }
        }

        let more_due_remaining = self
            .repository
            .has_eligible_due_work(observed_local)
            .await?;
        Ok(ProcessingSliceOutcome {
            committed,
            already_fulfilled,
            more_due_remaining,
            stop_reason: ProcessingStopReason::BudgetExhausted,
            observed_local,
        })
    }
}
