use super::adopt::{
    AdoptRecurringTransaction, AdoptionPreview, AdoptionPreviewRequest, count_later_due_occurrences,
};
use super::bulk::{
    RecurringBulkExecuteResult, RecurringBulkPreflight, RecurringBulkRequest, RecurringMatchingIds,
};
use super::create::{NewRecurringTransaction, normalize_template_description};
use super::document::{
    RecurringAdoptOutcome, RecurringCreateOutcome, RecurringFeedItem, RecurringFeedResult,
    RecurringTransactionDocument, TransactionRecurringProvenance, visible_source_link,
};
use super::edit::{RecurringMutationOutcome, UpdateRecurringTransaction};
use super::lifecycle::{
    RecurringLifecycleCommand, RecurringLifecycleOutcome, RecurringLifecycleUpdate,
};
use super::models::{
    DEFAULT_FEED_LIMIT, MAX_FEED_LIMIT, RecurringFailurePage, RecurringFeedEntry,
    RecurringLifecycle, RecurringOccurrencePage,
};
use super::process::{ProcessingSliceOutcome, ProcessingWorkBudget};
use super::process_slice::run_processing_slice;
use super::projection::BudgetProjectionQuery;
use super::repair::{
    GenerationFailureDiagnostics, PreviewRecurringGenerationRepair, RecurringRecoveryOutcome,
    RecurringRepairPreview, RepairRecurringGenerationFailure, RetryRecurringGenerationFailure,
};
use super::schedule::scheduled_local_at;
use super::traits::{
    RecurringOccurrenceProcessor, RecurringProcessingWake, RecurringTransactionsRepositoryTrait,
    RecurringTransactionsServiceTrait,
};
use crate::features::budgets::traits::CalendarClock;
use crate::{Error, Result};
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use uuid::Uuid;

pub struct RecurringTransactionsService {
    pub(super) repository: Arc<dyn RecurringTransactionsRepositoryTrait>,
    pub(super) clock: Arc<dyn CalendarClock>,
    wake: std::sync::RwLock<Option<Arc<dyn RecurringProcessingWake>>>,
}

impl RecurringTransactionsService {
    pub fn new(
        repository: Arc<dyn RecurringTransactionsRepositoryTrait>,
        clock: Arc<dyn CalendarClock>,
    ) -> Self {
        Self {
            repository,
            clock,
            wake: std::sync::RwLock::new(None),
        }
    }

    pub fn attach_wake(&self, wake: Arc<dyn RecurringProcessingWake>) {
        *self.wake.write().expect("wake lock") = Some(wake);
    }

    pub(super) fn assign_id(input_id: Option<String>) -> Result<String> {
        match input_id.as_deref().map(str::trim) {
            Some("") => Err(Error::InvalidData(
                "Recurring transaction id cannot be blank".into(),
            )),
            Some(id) => Ok(id.to_string()),
            None => Ok(Uuid::new_v4().to_string()),
        }
    }

    pub(super) fn request_processing_wake(&self) {
        if let Some(wake) = self.wake.read().expect("wake lock").as_ref() {
            wake.request_wake();
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
        for RecurringFeedEntry {
            recurring_transaction,
            description,
            next_scheduled_local,
            needs_attention,
        } in page.items
        {
            items.push(RecurringFeedItem {
                recurring_transaction,
                description,
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
        Ok(Some(TransactionRecurringProvenance {
            occurrence,
            source: visible_source_link(&recurring, &template.description),
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
        input.template.description = normalize_template_description(&input.template.description);
        input.id = Some(Self::assign_id(input.id)?);
        let first_scheduled_local =
            scheduled_local_at(&input.schedule, input.first_scheduled_local, 1)?;
        input.first_scheduled_local = first_scheduled_local;
        input.validate()?;

        let created = self.repository.create_recurring_transaction(input).await?;
        let document = self.compose_document(created).await?;
        self.request_processing_wake();
        Ok(RecurringCreateOutcome::Succeeded { document })
    }

    async fn update(&self, input: UpdateRecurringTransaction) -> Result<RecurringMutationOutcome> {
        self.update_inner(input).await
    }

    async fn pause(&self, input: RecurringLifecycleUpdate) -> Result<RecurringLifecycleOutcome> {
        self.apply_lifecycle(RecurringLifecycleCommand::Pause, input)
            .await
    }

    async fn resume(&self, input: RecurringLifecycleUpdate) -> Result<RecurringLifecycleOutcome> {
        self.apply_lifecycle(RecurringLifecycleCommand::Resume, input)
            .await
    }

    async fn stop(&self, input: RecurringLifecycleUpdate) -> Result<RecurringLifecycleOutcome> {
        self.apply_lifecycle(RecurringLifecycleCommand::Stop, input)
            .await
    }

    async fn delete(&self, input: RecurringLifecycleUpdate) -> Result<RecurringLifecycleOutcome> {
        self.apply_lifecycle(RecurringLifecycleCommand::Delete, input)
            .await
    }

    async fn preview_generation_repair(
        &self,
        input: PreviewRecurringGenerationRepair,
    ) -> Result<RecurringRepairPreview> {
        self.preview_generation_repair_inner(input).await
    }

    async fn repair_and_retry(
        &self,
        input: RepairRecurringGenerationFailure,
    ) -> Result<RecurringRecoveryOutcome> {
        self.repair_and_retry_inner(input).await
    }

    async fn retry_generation(
        &self,
        input: RetryRecurringGenerationFailure,
    ) -> Result<RecurringRecoveryOutcome> {
        self.retry_generation_inner(input).await
    }

    async fn generation_failure_diagnostics(
        &self,
        recurring_transaction_id: &str,
    ) -> Result<GenerationFailureDiagnostics> {
        self.generation_failure_diagnostics_inner(recurring_transaction_id)
            .await
    }

    async fn list_failure_history(
        &self,
        recurring_transaction_id: &str,
        limit: Option<i64>,
        cursor: Option<String>,
    ) -> Result<RecurringFailurePage> {
        self.list_failure_history_inner(recurring_transaction_id, limit, cursor)
            .await
    }

    async fn project_budgets(
        &self,
        query: BudgetProjectionQuery,
    ) -> Result<super::projection::BudgetProjectionResult> {
        self.compute_projection(query).await
    }

    async fn list_matching_ids(&self) -> Result<RecurringMatchingIds> {
        self.list_matching_ids_inner().await
    }

    async fn preflight_bulk(
        &self,
        request: RecurringBulkRequest,
    ) -> Result<RecurringBulkPreflight> {
        self.preflight_bulk_inner(request).await
    }

    async fn execute_bulk(
        &self,
        request: RecurringBulkRequest,
    ) -> Result<RecurringBulkExecuteResult> {
        self.execute_bulk_inner(request).await
    }

    async fn adopt(&self, input: AdoptRecurringTransaction) -> Result<RecurringAdoptOutcome> {
        self.adopt_inner(input).await
    }
}

#[async_trait::async_trait]
impl RecurringOccurrenceProcessor for RecurringTransactionsService {
    async fn process_due(
        &self,
        observed_local: chrono::NaiveDateTime,
        work_budget: ProcessingWorkBudget,
        cancelled: Option<&AtomicBool>,
    ) -> Result<ProcessingSliceOutcome> {
        run_processing_slice(
            self.repository.as_ref(),
            observed_local,
            work_budget,
            cancelled,
        )
        .await
    }
}
