use super::create::{
    create_recurring_transaction, find_open_schedule_revision, find_open_template_revision,
};
use super::fulfill::{
    has_eligible_due_work as query_has_eligible_due_work, process_one_due_occurrence,
};
use super::queries::{
    earliest_active_head_after, find_provenance_by_transaction, find_unresolved_failure,
    get_occurrence_head, get_recurring_transaction, list_due_heads, list_failure_history,
    list_feed, list_occurrences, list_unresolved_failures,
};
use super::revisions::{find_schedule_revision_at, find_template_revision_at};
use crate::blocking::run_blocking;
use crate::connection::{DbPool, get_connection};
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::{DomainAlertEventPublisher, publish_created_alerts};
use zai_core::features::recurring_transactions::{
    NewRecurringTransaction, ProcessOneOutcome, RecurringFailurePage, RecurringFeedPage,
    RecurringGenerationFailure, RecurringOccurrence, RecurringOccurrenceHead,
    RecurringOccurrencePage, RecurringScheduleRevision, RecurringTemplateRevision,
    RecurringTransaction, RecurringTransactionsRepositoryTrait,
};

pub struct RecurringTransactionsRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
    #[allow(dead_code)]
    clock: Arc<dyn CalendarClock>,
    alert_publisher: Arc<dyn DomainAlertEventPublisher>,
}

impl RecurringTransactionsRepository {
    #[cfg(test)]
    pub(crate) fn new(pool: Arc<DbPool>, writer: WriteHandle) -> Self {
        Self::new_with_clock_and_publisher(
            pool,
            writer,
            Arc::new(zai_core::features::budgets::traits::LocalCalendarClock),
            zai_core::features::domain_alerts::DomainAlertEventBus::new(),
        )
    }

    pub(crate) fn new_with_clock_and_publisher(
        pool: Arc<DbPool>,
        writer: WriteHandle,
        clock: Arc<dyn CalendarClock>,
        alert_publisher: Arc<dyn DomainAlertEventPublisher>,
    ) -> Self {
        Self {
            pool,
            writer,
            clock,
            alert_publisher,
        }
    }

    #[cfg(test)]
    #[allow(dead_code)]
    pub(crate) fn writer(&self) -> &WriteHandle {
        &self.writer
    }

    pub fn pool(&self) -> &Arc<DbPool> {
        &self.pool
    }
}

#[async_trait]
impl RecurringTransactionsRepositoryTrait for RecurringTransactionsRepository {
    async fn list_feed(&self, limit: i64, cursor: Option<String>) -> Result<RecurringFeedPage> {
        let pool = Arc::clone(&self.pool);
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            list_feed(&mut conn, limit, cursor.as_deref())
        })
        .await
    }

    async fn list_due_heads(
        &self,
        observed_local: NaiveDateTime,
        limit: i64,
    ) -> Result<Vec<RecurringOccurrenceHead>> {
        let pool = Arc::clone(&self.pool);
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            list_due_heads(&mut conn, observed_local, limit)
        })
        .await
    }

    async fn earliest_active_head_after(
        &self,
        after_local: NaiveDateTime,
    ) -> Result<Option<NaiveDateTime>> {
        let pool = Arc::clone(&self.pool);
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            earliest_active_head_after(&mut conn, after_local)
        })
        .await
    }

    async fn list_occurrences(
        &self,
        recurring_transaction_id: &str,
        limit: i64,
        cursor: Option<String>,
    ) -> Result<RecurringOccurrencePage> {
        let pool = Arc::clone(&self.pool);
        let recurring_transaction_id = recurring_transaction_id.to_string();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            list_occurrences(
                &mut conn,
                &recurring_transaction_id,
                limit,
                cursor.as_deref(),
            )
        })
        .await
    }

    async fn find_provenance_by_transaction(
        &self,
        transaction_id: &str,
    ) -> Result<Option<RecurringOccurrence>> {
        let pool = Arc::clone(&self.pool);
        let transaction_id = transaction_id.to_string();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            find_provenance_by_transaction(&mut conn, &transaction_id)
        })
        .await
    }

    async fn list_failure_history(
        &self,
        recurring_transaction_id: &str,
        limit: i64,
        cursor: Option<String>,
    ) -> Result<RecurringFailurePage> {
        let pool = Arc::clone(&self.pool);
        let recurring_transaction_id = recurring_transaction_id.to_string();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            list_failure_history(
                &mut conn,
                &recurring_transaction_id,
                limit,
                cursor.as_deref(),
            )
        })
        .await
    }

    async fn list_unresolved_failures(
        &self,
        limit: i64,
    ) -> Result<Vec<RecurringGenerationFailure>> {
        let pool = Arc::clone(&self.pool);
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            list_unresolved_failures(&mut conn, limit)
        })
        .await
    }

    async fn find_unresolved_failure(
        &self,
        recurring_transaction_id: &str,
    ) -> Result<Option<RecurringGenerationFailure>> {
        let pool = Arc::clone(&self.pool);
        let recurring_transaction_id = recurring_transaction_id.to_string();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            find_unresolved_failure(&mut conn, &recurring_transaction_id)
        })
        .await
    }

    async fn get_recurring_transaction(&self, id: &str) -> Result<RecurringTransaction> {
        let pool = Arc::clone(&self.pool);
        let id = id.to_string();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            get_recurring_transaction(&mut conn, &id)
        })
        .await
    }

    async fn get_occurrence_head(
        &self,
        recurring_transaction_id: &str,
    ) -> Result<Option<RecurringOccurrenceHead>> {
        let pool = Arc::clone(&self.pool);
        let recurring_transaction_id = recurring_transaction_id.to_string();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            get_occurrence_head(&mut conn, &recurring_transaction_id)
        })
        .await
    }

    async fn find_schedule_revision_at(
        &self,
        recurring_transaction_id: &str,
        at_local: NaiveDateTime,
    ) -> Result<Option<RecurringScheduleRevision>> {
        let pool = Arc::clone(&self.pool);
        let recurring_transaction_id = recurring_transaction_id.to_string();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            find_schedule_revision_at(&mut conn, &recurring_transaction_id, at_local)
        })
        .await
    }

    async fn find_template_revision_at(
        &self,
        recurring_transaction_id: &str,
        at_local: NaiveDateTime,
    ) -> Result<Option<RecurringTemplateRevision>> {
        let pool = Arc::clone(&self.pool);
        let recurring_transaction_id = recurring_transaction_id.to_string();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            find_template_revision_at(&mut conn, &recurring_transaction_id, at_local)
        })
        .await
    }

    async fn find_open_schedule_revision(
        &self,
        recurring_transaction_id: &str,
    ) -> Result<Option<RecurringScheduleRevision>> {
        let pool = Arc::clone(&self.pool);
        let recurring_transaction_id = recurring_transaction_id.to_string();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            find_open_schedule_revision(&mut conn, &recurring_transaction_id)
        })
        .await
    }

    async fn find_open_template_revision(
        &self,
        recurring_transaction_id: &str,
    ) -> Result<Option<RecurringTemplateRevision>> {
        let pool = Arc::clone(&self.pool);
        let recurring_transaction_id = recurring_transaction_id.to_string();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            find_open_template_revision(&mut conn, &recurring_transaction_id)
        })
        .await
    }

    async fn create_recurring_transaction(
        &self,
        input: NewRecurringTransaction,
    ) -> Result<RecurringTransaction> {
        self.writer
            .exec(move |conn| create_recurring_transaction(conn, input))
            .await
    }

    async fn has_eligible_due_work(&self, observed_local: NaiveDateTime) -> Result<bool> {
        let pool = Arc::clone(&self.pool);
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            query_has_eligible_due_work(&mut conn, observed_local).map_err(Into::into)
        })
        .await
    }

    async fn process_one_due_occurrence(
        &self,
        observed_local: NaiveDateTime,
    ) -> Result<ProcessOneOutcome> {
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = match self
            .writer
            .exec(move |conn| process_one_due_occurrence(conn, observed_local, observed_local))
            .await
        {
            Ok(outcome) => outcome,
            Err(error) if is_competing_fulfillment_unique_violation(&error) => {
                // Winner committed; loser reselects canonical durable state under the writer.
                self.writer
                    .exec(move |conn| {
                        process_one_due_occurrence(conn, observed_local, observed_local)
                    })
                    .await?
            }
            Err(error) => return Err(error),
        };
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }
}

fn is_competing_fulfillment_unique_violation(error: &zai_core::Error) -> bool {
    match error {
        zai_core::Error::Database(zai_core::DatabaseError::UniqueViolation(message)) => {
            let message = message.to_ascii_lowercase();
            message.contains("recurring_occurrences")
                || message.contains("fulfillment_position")
                || message.contains("domain_alerts")
                || message.contains("occurrence_key")
        }
        _ => false,
    }
}
