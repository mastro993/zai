use super::document::{
    RecurringBudgetImpactSection, RecurringSectionState, RecurringTransactionDocument,
    failures_section_with_waiting, links_section, occurrence_summary,
};
use super::models::{
    DEFAULT_FAILURE_LIMIT, DEFAULT_FEED_LIMIT, RecurringLifecycle, RecurringTransaction,
};
use super::projection::{BudgetProjectionQuery, BudgetProjectionResult, compute_budget_projection};
use super::service::RecurringTransactionsService;
use crate::{Error, Result};

impl RecurringTransactionsService {
    pub(super) async fn compose_document(
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
        let waiting_count = match unresolved.as_ref() {
            Some(failure) => {
                self.waiting_count_for_failure(
                    &recurring.id,
                    failure.ordinal,
                    recurring.total_occurrences,
                )
                .await?
            }
            None => 0,
        };

        let links = self
            .repository
            .list_occurrences(&recurring.id, DEFAULT_FEED_LIMIT, None)
            .await?;
        let history = self
            .repository
            .list_failure_history(&recurring.id, DEFAULT_FAILURE_LIMIT, None)
            .await?;

        let budget_impact = match self
            .compute_projection(BudgetProjectionQuery {
                horizon_months: 3,
                include_paused_budgets: false,
                focus_recurring_transaction_id: Some(recurring.id.clone()),
            })
            .await
        {
            Ok(projection) => Self::budget_impact_from_projection(&projection, &recurring.id),
            Err(error @ (Error::Database(_) | Error::Repository(_) | Error::Unexpected(_))) => {
                return Err(error);
            }
            Err(error) => RecurringBudgetImpactSection {
                state: RecurringSectionState::Unavailable,
                message: Some(error.to_string()),
                projection: None,
            },
        };

        Ok(RecurringTransactionDocument {
            occurrence_summary: occurrence_summary(&recurring, head.as_ref(), needs_attention),
            links: links_section(links),
            failures: failures_section_with_waiting(unresolved, history, waiting_count),
            budget_impact,
            recurring_transaction: recurring,
            schedule,
            template,
            head,
        })
    }

    pub(super) async fn compute_projection(
        &self,
        query: BudgetProjectionQuery,
    ) -> Result<BudgetProjectionResult> {
        let observed_local = self.clock.sample();
        let input = self
            .repository
            .load_budget_projection_input(
                observed_local,
                query.horizon_months,
                query.include_paused_budgets,
                query.focus_recurring_transaction_id.clone(),
            )
            .await?;
        compute_budget_projection(input)
    }

    pub(super) fn budget_impact_from_projection(
        projection: &BudgetProjectionResult,
        recurring_transaction_id: &str,
    ) -> RecurringBudgetImpactSection {
        let focused = projection
            .clone()
            .focused_attribution(recurring_transaction_id);
        let has_attribution = focused
            .periods
            .iter()
            .any(|period| !period.attribution.is_empty());
        let state = if has_attribution || !focused.periods.is_empty() {
            RecurringSectionState::Ready
        } else {
            RecurringSectionState::Empty
        };
        RecurringBudgetImpactSection {
            state,
            message: None,
            projection: Some(focused),
        }
    }
}
