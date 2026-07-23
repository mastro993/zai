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
use super::matching::list_matching_ids_filtered;
use super::queries::{
    earliest_active_head_after, find_provenance_by_transaction, find_unresolved_failure,
    get_occurrence_head, get_recurring_transaction, list_due_heads, list_failure_history,
    list_feed_filtered, list_occurrences, list_unresolved_failures,
};
use super::repair::{apply_generation_repair, preview_template_field_repair};
use super::repository::{
    RecurringTransactionsRepository, is_competing_fulfillment_unique_violation,
};
use super::revisions::{find_schedule_revision_at, find_template_revision_at};
use crate::blocking::run_blocking;
use crate::connection::get_connection;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::domain_alerts::publish_created_alerts;
use zai_core::features::recurring_transactions::projection::ProjectionComputeInput;
use zai_core::features::recurring_transactions::{
    AdoptRecurringTransaction, NewRecurringTransaction, ProcessOneOutcome, RecurringFailurePage,
    RecurringFeedFilters, RecurringFeedPage, RecurringGenerationFailure, RecurringLifecycleCommand,
    RecurringLifecycleUpdate, RecurringMatchingIdentity, RecurringOccurrence,
    RecurringOccurrenceHead, RecurringOccurrencePage, RecurringRepairField,
    RecurringScheduleRevision, RecurringTemplateInput, RecurringTemplateRevision,
    RecurringTransaction, RecurringTransactionsRepositoryTrait, UpdateRecurringTransaction,
};

#[async_trait]
impl RecurringTransactionsRepositoryTrait for RecurringTransactionsRepository {
    async fn list_feed_filtered(
        &self,
        limit: i64,
        cursor: Option<String>,
        filters: RecurringFeedFilters,
    ) -> Result<RecurringFeedPage> {
        let pool = Arc::clone(&self.pool);
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            list_feed_filtered(&mut conn, limit, cursor.as_deref(), &filters)
        })
        .await
    }

    async fn list_matching_ids_filtered(
        &self,
        filters: RecurringFeedFilters,
    ) -> Result<Vec<RecurringMatchingIdentity>> {
        let pool = Arc::clone(&self.pool);
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            list_matching_ids_filtered(&mut conn, &filters)
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
            .exec_for_fulfillment(move |conn| {
                process_one_due_occurrence(conn, observed_local, observed_local)
            })
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
        repair_field_key: RecurringRepairField,
        template: RecurringTemplateInput,
    ) -> Result<RecurringTransaction> {
        let now = chrono::Utc::now().naive_utc();
        self.writer
            .exec(move |conn| {
                apply_generation_repair(
                    conn,
                    &recurring_transaction_id,
                    expected_revision,
                    repair_field_key,
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
        self.read_current_schema_version().await
    }

    async fn load_budget_projection_input(
        &self,
        observed_local: NaiveDateTime,
        horizon_months: u32,
        include_paused_budgets: bool,
        focus_recurring_transaction_id: Option<String>,
    ) -> Result<ProjectionComputeInput> {
        self.load_projection_compute_input(
            observed_local,
            horizon_months,
            include_paused_budgets,
            focus_recurring_transaction_id,
        )
        .await
    }
}
