use super::adopt::{
    adopt_existing_transaction, find_visible_transaction_date as query_visible_transaction_date,
};
use super::create::{
    create_recurring_transaction, find_open_schedule_revision, find_open_template_revision,
};
use super::edit::update_recurring_transaction;
use super::fulfill::{
    has_eligible_due_work as query_has_eligible_due_work, process_one_due_occurrence,
};
use super::lifecycle::apply_lifecycle_command;
use super::queries::{
    earliest_active_head_after, find_provenance_by_transaction, find_unresolved_failure,
    get_occurrence_head, get_recurring_transaction, list_due_heads, list_failure_history,
    list_feed, list_occurrences, list_unresolved_failures,
};
use super::repair::{apply_generation_repair, preview_template_field_repair};
use super::revisions::{find_schedule_revision_at, find_template_revision_at};
use crate::blocking::run_blocking;
use crate::connection::{DbPool, get_connection};
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use diesel::sql_types::Text;
use diesel::{QueryableByName, RunQueryDsl, sql_query};
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::{DomainAlertEventPublisher, publish_created_alerts};
use zai_core::features::recurring_transactions::{
    AdoptRecurringTransaction, NewRecurringTransaction, ProcessOneOutcome, RecurringFailurePage,
    RecurringFeedPage, RecurringGenerationFailure, RecurringLifecycleCommand,
    RecurringLifecycleUpdate, RecurringOccurrence, RecurringOccurrenceHead,
    RecurringOccurrencePage, RecurringScheduleRevision, RecurringTemplateInput,
    RecurringTemplateRevision, RecurringTransaction, RecurringTransactionsRepositoryTrait,
    UpdateRecurringTransaction,
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

    async fn update_recurring_transaction(
        &self,
        input: UpdateRecurringTransaction,
        observed_local: NaiveDateTime,
        apply_schedule: bool,
        apply_template: bool,
        apply_count: bool,
    ) -> Result<RecurringTransaction> {
        self.writer
            .exec(move |conn| {
                update_recurring_transaction(
                    conn,
                    input,
                    observed_local,
                    apply_schedule,
                    apply_template,
                    apply_count,
                )
            })
            .await
    }

    async fn apply_lifecycle_command(
        &self,
        command: RecurringLifecycleCommand,
        update: RecurringLifecycleUpdate,
        observed_local: NaiveDateTime,
    ) -> Result<RecurringTransaction> {
        let now = chrono::Utc::now().naive_utc();
        self.writer
            .exec(move |conn| apply_lifecycle_command(conn, command, update, observed_local, now))
            .await
    }

    async fn find_visible_transaction_date(&self, transaction_id: &str) -> Result<NaiveDateTime> {
        let pool = Arc::clone(&self.pool);
        let transaction_id = transaction_id.to_string();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            query_visible_transaction_date(&mut conn, &transaction_id).map_err(Into::into)
        })
        .await
    }

    async fn adopt_existing_transaction(
        &self,
        input: AdoptRecurringTransaction,
        observed_local: NaiveDateTime,
    ) -> Result<RecurringTransaction> {
        self.writer
            .exec(move |conn| adopt_existing_transaction(conn, input, observed_local))
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

    async fn apply_generation_repair(
        &self,
        recurring_transaction_id: String,
        expected_revision: i32,
        repair_field_key: String,
        template: RecurringTemplateInput,
    ) -> Result<RecurringTransaction> {
        let now = chrono::Utc::now().naive_utc();
        self.writer
            .exec(move |conn| {
                apply_generation_repair(
                    conn,
                    &recurring_transaction_id,
                    expected_revision,
                    &repair_field_key,
                    &template,
                    now,
                )
                .map(|applied| applied.recurring)
            })
            .await
    }

    async fn preview_generation_repair(
        &self,
        recurring_transaction_id: &str,
    ) -> Result<(i32, bool)> {
        let pool = Arc::clone(&self.pool);
        let recurring_transaction_id = recurring_transaction_id.to_string();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            preview_template_field_repair(&mut conn, &recurring_transaction_id).map_err(Into::into)
        })
        .await
    }

    async fn current_schema_version(&self) -> Result<String> {
        let pool = Arc::clone(&self.pool);
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            #[derive(QueryableByName)]
            struct SchemaVersionRow {
                #[diesel(sql_type = Text)]
                version: String,
            }
            let row = sql_query(
                "SELECT version FROM __diesel_schema_migrations ORDER BY version DESC LIMIT 1",
            )
            .get_result::<SchemaVersionRow>(&mut conn)
            .map_err(|error| {
                zai_core::Error::Database(zai_core::DatabaseError::QueryFailed(error.to_string()))
            })?;
            Ok(row.version)
        })
        .await
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
