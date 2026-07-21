use super::create::NewRecurringTransaction;
use super::document::{RecurringCreateOutcome, RecurringFeedResult, RecurringTransactionDocument};
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

    async fn create(&self, input: NewRecurringTransaction) -> Result<RecurringCreateOutcome>;
}

/// Internal occurrence processor used by trusted Rust orchestration.
///
/// Not exposed through Tauri IPC or public Axum REST endpoints.
#[async_trait]
pub trait RecurringOccurrenceProcessor: Send + Sync {
    async fn process_due(
        &self,
        observed_local: NaiveDateTime,
        work_budget: ProcessingWorkBudget,
        cancelled: Option<&AtomicBool>,
    ) -> Result<ProcessingSliceOutcome>;
}

pub trait RecurringProcessingWake: Send + Sync {
    fn request_wake(&self);
}
