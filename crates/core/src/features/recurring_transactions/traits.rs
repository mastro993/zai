use super::models::{
    RecurringFailurePage, RecurringFeedPage, RecurringGenerationFailure, RecurringOccurrence,
    RecurringOccurrenceHead, RecurringOccurrencePage, RecurringScheduleRevision,
    RecurringTemplateRevision, RecurringTransaction,
};
use crate::Result;
use async_trait::async_trait;
use chrono::NaiveDateTime;

#[async_trait]
pub trait RecurringTransactionsRepositoryTrait: Send + Sync {
    async fn list_feed(&self, limit: i64, cursor: Option<String>) -> Result<RecurringFeedPage>;

    async fn list_due_heads(
        &self,
        observed_local: NaiveDateTime,
        limit: i64,
    ) -> Result<Vec<RecurringOccurrenceHead>>;

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

    async fn list_unresolved_failures(&self, limit: i64) -> Result<Vec<RecurringGenerationFailure>>;

    async fn get_recurring_transaction(&self, id: &str) -> Result<RecurringTransaction>;

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
}
