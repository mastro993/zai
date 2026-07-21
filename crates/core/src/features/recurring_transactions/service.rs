use super::create::{NewRecurringTransaction, normalize_recurring_name};
use super::document::{
    RecurringCreateOutcome, RecurringFeedItem, RecurringFeedResult, RecurringTransactionDocument,
    budget_impact_unavailable, failures_section, links_section, occurrence_summary,
};
use super::models::{
    DEFAULT_FAILURE_LIMIT, DEFAULT_FEED_LIMIT, MAX_FEED_LIMIT, RecurringLifecycle,
    RecurringOccurrenceHead, RecurringTransaction,
};
use super::schedule::scheduled_local_at;
use super::traits::{RecurringTransactionsRepositoryTrait, RecurringTransactionsServiceTrait};
use crate::features::budgets::traits::CalendarClock;
use crate::{Error, Result};
use std::collections::{HashMap, HashSet};
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
        let unresolved = self
            .repository
            .list_unresolved_failures(MAX_FEED_LIMIT)
            .await?;
        let attention_ids: HashSet<String> = unresolved
            .into_iter()
            .map(|failure| failure.recurring_transaction_id)
            .collect();

        let mut heads_by_id: HashMap<String, RecurringOccurrenceHead> = HashMap::new();
        for item in &page.items {
            if let Some(head) = self.repository.get_occurrence_head(&item.id).await? {
                heads_by_id.insert(item.id.clone(), head);
            }
        }

        let items = page
            .items
            .into_iter()
            .map(|recurring_transaction| {
                let next_scheduled_local = heads_by_id
                    .get(&recurring_transaction.id)
                    .map(|head| head.next_scheduled_local);
                let needs_attention = attention_ids.contains(&recurring_transaction.id);
                RecurringFeedItem {
                    recurring_transaction,
                    next_scheduled_local,
                    needs_attention,
                }
            })
            .collect();

        Ok(RecurringFeedResult {
            items,
            next_cursor: page.next_cursor,
        })
    }

    async fn get_document(&self, id: &str) -> Result<RecurringTransactionDocument> {
        let recurring = self.repository.get_recurring_transaction(id).await?;
        self.compose_document(recurring).await
    }

    async fn create(&self, mut input: NewRecurringTransaction) -> Result<RecurringCreateOutcome> {
        let observed_local = self.clock.sample();
        input.name = normalize_recurring_name(&input.name);
        input.validate(observed_local)?;

        let id = input
            .id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        input.id = Some(id.clone());

        let first_scheduled_local =
            scheduled_local_at(&input.schedule, input.first_scheduled_local, 1)?;
        input.first_scheduled_local = first_scheduled_local;

        let created = self.repository.create_recurring_transaction(input).await?;
        let document = self.compose_document(created).await?;
        Ok(RecurringCreateOutcome::Succeeded { document })
    }
}
