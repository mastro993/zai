use super::adopt::{AdoptRecurringTransaction, AdoptionPreview, AdoptionPreviewRequest};
use super::create::NewRecurringTransaction;
use super::document::{
    RecurringAdoptOutcome, RecurringCreateOutcome, RecurringFeedResult,
    RecurringTransactionDocument, TransactionRecurringProvenance,
};
use super::edit::{RecurringMutationOutcome, UpdateRecurringTransaction};
use super::lifecycle::{
    RecurringLifecycleCommand, RecurringLifecycleOutcome, RecurringLifecycleUpdate,
};
use super::models::{
    RecurringFailurePage, RecurringFeedPage, RecurringGenerationFailure, RecurringOccurrence,
    RecurringOccurrenceHead, RecurringOccurrencePage, RecurringScheduleRevision,
    RecurringTemplateRevision, RecurringTransaction,
};
use super::process::{ProcessOneOutcome, ProcessingSliceOutcome, ProcessingWorkBudget};
use crate::Result;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use std::sync::atomic::AtomicBool;

#[async_trait]
pub trait RecurringTransactionsRepositoryTrait: Send + Sync {
    async fn list_feed(&self, limit: i64, cursor: Option<String>) -> Result<RecurringFeedPage>;

    async fn list_due_heads(
        &self,
        observed_local: NaiveDateTime,
        limit: i64,
    ) -> Result<Vec<RecurringOccurrenceHead>>;

    async fn earliest_active_head_after(
        &self,
        after_local: NaiveDateTime,
    ) -> Result<Option<NaiveDateTime>>;

    async fn list_occurrences(
        &self,
        recurring_transaction_id: &str,
        limit: i64,
        cursor: Option<String>,
    ) -> Result<RecurringOccurrencePage>;

    async fn find_provenance_by_transaction(
        &self,
        transaction_id: &str,
    ) -> Result<Option<RecurringOccurrence>>;

    async fn list_failure_history(
        &self,
        recurring_transaction_id: &str,
        limit: i64,
        cursor: Option<String>,
    ) -> Result<RecurringFailurePage>;

    async fn list_unresolved_failures(&self, limit: i64)
    -> Result<Vec<RecurringGenerationFailure>>;

    async fn find_unresolved_failure(
        &self,
        recurring_transaction_id: &str,
    ) -> Result<Option<RecurringGenerationFailure>>;

    async fn get_recurring_transaction(&self, id: &str) -> Result<RecurringTransaction>;

    async fn get_occurrence_head(
        &self,
        recurring_transaction_id: &str,
    ) -> Result<Option<RecurringOccurrenceHead>>;

    async fn find_schedule_revision_at(
        &self,
        recurring_transaction_id: &str,
        at_local: NaiveDateTime,
    ) -> Result<Option<RecurringScheduleRevision>>;

    async fn find_template_revision_at(
        &self,
        recurring_transaction_id: &str,
        at_local: NaiveDateTime,
    ) -> Result<Option<RecurringTemplateRevision>>;

    async fn find_open_schedule_revision(
        &self,
        recurring_transaction_id: &str,
    ) -> Result<Option<RecurringScheduleRevision>>;

    async fn find_open_template_revision(
        &self,
        recurring_transaction_id: &str,
    ) -> Result<Option<RecurringTemplateRevision>>;

    async fn create_recurring_transaction(
        &self,
        input: NewRecurringTransaction,
    ) -> Result<RecurringTransaction>;

    async fn update_recurring_transaction(
        &self,
        input: UpdateRecurringTransaction,
        observed_local: NaiveDateTime,
        apply_schedule: bool,
        apply_template: bool,
        apply_count: bool,
    ) -> Result<RecurringTransaction>;

    async fn apply_lifecycle_command(
        &self,
        command: RecurringLifecycleCommand,
        update: RecurringLifecycleUpdate,
        observed_local: NaiveDateTime,
    ) -> Result<RecurringTransaction>;

    async fn find_visible_transaction_date(&self, transaction_id: &str) -> Result<NaiveDateTime>;

    async fn adopt_existing_transaction(
        &self,
        input: AdoptRecurringTransaction,
        observed_local: NaiveDateTime,
    ) -> Result<RecurringTransaction>;

    async fn has_eligible_due_work(&self, observed_local: NaiveDateTime) -> Result<bool>;

    async fn process_one_due_occurrence(
        &self,
        observed_local: NaiveDateTime,
    ) -> Result<ProcessOneOutcome>;
}

#[async_trait]
pub trait RecurringTransactionsServiceTrait: Send + Sync {
    async fn list_feed(
        &self,
        limit: Option<i64>,
        cursor: Option<String>,
    ) -> Result<RecurringFeedResult>;

    async fn get_document(&self, id: &str) -> Result<RecurringTransactionDocument>;

    async fn list_linked_occurrences(
        &self,
        recurring_transaction_id: &str,
        limit: Option<i64>,
        cursor: Option<String>,
    ) -> Result<RecurringOccurrencePage>;

    async fn get_transaction_provenance(
        &self,
        transaction_id: &str,
    ) -> Result<Option<TransactionRecurringProvenance>>;

    async fn preview_adoption(&self, input: AdoptionPreviewRequest) -> Result<AdoptionPreview>;

    async fn create(&self, input: NewRecurringTransaction) -> Result<RecurringCreateOutcome>;

    async fn update(&self, input: UpdateRecurringTransaction) -> Result<RecurringMutationOutcome>;

    async fn adopt(&self, input: AdoptRecurringTransaction) -> Result<RecurringAdoptOutcome>;

    async fn pause(&self, input: RecurringLifecycleUpdate) -> Result<RecurringLifecycleOutcome>;

    async fn resume(&self, input: RecurringLifecycleUpdate) -> Result<RecurringLifecycleOutcome>;

    async fn stop(&self, input: RecurringLifecycleUpdate) -> Result<RecurringLifecycleOutcome>;

    async fn delete(&self, input: RecurringLifecycleUpdate) -> Result<RecurringLifecycleOutcome>;
}

/// Internal occurrence processor used by trusted Rust orchestration.
///
/// Not exposed through Tauri IPC or public Axum REST endpoints.
#[async_trait]
pub trait RecurringOccurrenceProcessor: Send + Sync {
    async fn process_due(
        &self,
        observed_local: chrono::NaiveDateTime,
        work_budget: ProcessingWorkBudget,
        cancelled: Option<&AtomicBool>,
    ) -> Result<ProcessingSliceOutcome>;
}

pub trait RecurringProcessingWake: Send + Sync {
    fn request_wake(&self);
}
