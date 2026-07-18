use super::alerts::{
    emit_budget_transition_alerts, emit_resume_budget_alert, emit_timeline_transition_alerts,
    snapshot_budgets_by_ids,
};
use super::calculation::map_budget_insert_error;
use super::edit::update_budget as update_budget_in_storage;
use super::history::load_history;
use super::lifecycle::{delete_budget as delete_budget_in_storage, set_budget_paused};
use super::models::BudgetRow;
use super::timeline::{
    BudgetPeriodTimeline, SourceChange, TimelineInspectEntry, TimelineSelection,
    load_category_hierarchy, load_current_or_ensure,
};
use crate::blocking::run_blocking;
use crate::connection::{DbPool, get_connection};
use crate::errors::IntoCore;
use crate::schema::budgets;
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use std::sync::Arc;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::budgets::models::{
    Budget, BudgetCadence, BudgetLifecycleUpdate, BudgetListFilter, BudgetPeriodHistory,
    BudgetUpdate, NewBudget, canonicalize_category_ids,
};
use zai_core::features::budgets::traits::{BudgetsRepositoryTrait, CalendarClock};
use zai_core::features::domain_alerts::{
    CommittedOutcome, DomainAlertEventPublisher, publish_created_alerts,
};
use zai_core::{Error, Result};

pub struct BudgetsRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
    clock: Arc<dyn CalendarClock>,
    alert_publisher: Arc<dyn DomainAlertEventPublisher>,
}

impl BudgetsRepository {
    #[cfg(test)]
    pub(crate) fn new(pool: Arc<DbPool>, writer: WriteHandle) -> Self {
        Self::new_with_clock_and_publisher(
            pool,
            writer,
            Arc::new(zai_core::features::budgets::traits::LocalCalendarClock),
            zai_core::features::domain_alerts::DomainAlertEventBus::new(),
        )
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn new_with_clock(
        pool: Arc<DbPool>,
        writer: WriteHandle,
        clock: Arc<dyn CalendarClock>,
    ) -> Self {
        Self::new_with_clock_and_publisher(
            pool,
            writer,
            clock,
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

    async fn get_or_ensure_current(&self, id: &str, now: NaiveDateTime) -> Result<Budget> {
        let pool = Arc::clone(&self.pool);
        let id_owned = id.to_owned();
        let inspect = run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            BudgetPeriodTimeline::inspect(&mut conn, TimelineSelection::Ids(vec![id_owned]), now)
                .into_core()
        })
        .await?;

        if inspect.stale_ids().is_empty() {
            return inspect
                .entries
                .into_iter()
                .find_map(|entry| match entry {
                    TimelineInspectEntry::Current(budget) => Some(Ok(budget)),
                    TimelineInspectEntry::Stale { .. } => None,
                })
                .unwrap_or(Err(Error::Database(zai_core::DatabaseError::NotFound(
                    "Record not found".to_string(),
                ))));
        }

        let id = id.to_string();
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(move |conn| {
                let (budgets, changes) = BudgetPeriodTimeline::ensure_current(conn, &[id], now)?;
                let alerts = emit_timeline_transition_alerts(conn, &changes, &budgets)?;
                Ok(CommittedOutcome::with_alert_outcomes(budgets, alerts))
            })
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        outcome.value.into_iter().next().ok_or_else(|| {
            Error::Database(zai_core::DatabaseError::NotFound(
                "Record not found".to_string(),
            ))
        })
    }
}

#[async_trait]
impl BudgetsRepositoryTrait for BudgetsRepository {
    async fn list_budgets(&self, filter: BudgetListFilter) -> Result<Vec<Budget>> {
        let now = self.clock.sample();
        let pool = Arc::clone(&self.pool);
        let inspect = run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            BudgetPeriodTimeline::inspect(&mut conn, TimelineSelection::Filter(filter), now)
                .into_core()
        })
        .await?;

        let stale_ids = inspect.stale_ids();
        let entries = inspect.entries;
        if stale_ids.is_empty() {
            return Ok(entries
                .into_iter()
                .filter_map(|entry| match entry {
                    TimelineInspectEntry::Current(budget) => Some(budget),
                    TimelineInspectEntry::Stale { .. } => None,
                })
                .collect());
        }

        let stale_ids_for_repair = stale_ids.clone();
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(move |conn| {
                let (repaired, changes) =
                    BudgetPeriodTimeline::ensure_current(conn, &stale_ids_for_repair, now)?;
                let alerts = emit_timeline_transition_alerts(conn, &changes, &repaired)?;
                Ok(CommittedOutcome::with_alert_outcomes(repaired, alerts))
            })
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        let repaired_by_id = outcome
            .value
            .into_iter()
            .map(|budget| (budget.id.clone(), budget))
            .collect::<std::collections::HashMap<_, _>>();
        Ok(entries
            .into_iter()
            .filter_map(|entry| match entry {
                TimelineInspectEntry::Current(budget) => Some(budget),
                TimelineInspectEntry::Stale { id } => repaired_by_id.get(&id).cloned(),
            })
            .collect())
    }

    async fn get_budget(&self, id: &str) -> Result<Budget> {
        self.get_or_ensure_current(id, self.clock.sample()).await
    }

    async fn get_budget_history(
        &self,
        id: &str,
        page: i64,
        per_page: i64,
    ) -> Result<BudgetPeriodHistory> {
        zai_core::features::budgets::models::validate_history_paging(page, per_page)?;
        let now = self.clock.sample();
        self.get_or_ensure_current(id, now).await?;
        let pool = Arc::clone(&self.pool);
        let id = id.to_owned();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            load_history(&mut conn, &id, page, per_page)
        })
        .await
    }

    async fn create_budget(&self, budget: NewBudget) -> Result<Budget> {
        let id = budget
            .id
            .clone()
            .ok_or_else(|| Error::InvalidData("Budget id is required".to_string()))?;
        let now = self.clock.sample();
        let cadence = budget.cadence.unwrap_or_default();
        let measurement_mode = budget.measurement_mode.unwrap_or_default();
        let rollover_mode = budget.rollover_mode.unwrap_or_default();
        let warning_percentage = budget.warning_percentage;
        let base_allowance = budget.base_allowance;
        let name = budget.name;
        let selected_category_ids = budget.category_ids;
        self.writer
            .exec(move |conn| {
                let categories = load_category_hierarchy(conn)?;
                let category_ids = canonicalize_category_ids(&selected_category_ids, &categories);
                let timestamp = chrono::Utc::now().naive_utc();
                let budget_row = BudgetRow {
                    id: id.clone(),
                    name: name.clone(),
                    cadence: cadence.to_string(),
                    measurement_mode: measurement_mode.to_string(),
                    base_allowance,
                    rollover_mode: rollover_mode.to_string(),
                    warning_percentage,
                    created_at: timestamp,
                    updated_at: timestamp,
                    deleted_at: None,
                    revision: 0,
                    paused: false,
                };
                diesel::insert_into(budgets::table)
                    .values(&budget_row)
                    .execute(conn)
                    .map_err(map_budget_insert_error)?;
                BudgetPeriodTimeline::reconcile(
                    conn,
                    SourceChange::BudgetCreated {
                        budget_id: id.clone(),
                        category_ids,
                    },
                    now,
                )?;
                load_current_or_ensure(conn, &id, now)
            })
            .await
    }

    async fn update_budget(&self, id: &str, update: BudgetUpdate) -> Result<Budget> {
        let now = self.clock.sample();
        let budget_id = id.to_string();
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(move |conn| {
                let before = snapshot_budgets_by_ids(conn, std::slice::from_ref(&budget_id), now)?;
                let budget = update_budget_in_storage(conn, &budget_id, update, now)?;
                let after = snapshot_budgets_by_ids(conn, &[budget_id], now)?;
                let alerts = emit_budget_transition_alerts(
                    conn,
                    BudgetAlertMode::Transition,
                    &before,
                    &after,
                )?;
                Ok(CommittedOutcome::with_alert_outcomes(budget, alerts))
            })
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn pause_budget(&self, id: &str, update: BudgetLifecycleUpdate) -> Result<Budget> {
        let now = self.clock.sample();
        let id = id.to_string();
        self.writer
            .exec(move |conn| set_budget_paused(conn, &id, update, true, now))
            .await
    }

    async fn resume_budget(&self, id: &str, update: BudgetLifecycleUpdate) -> Result<Budget> {
        let now = self.clock.sample();
        let budget_id = id.to_string();
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(move |conn| {
                let budget = set_budget_paused(conn, &budget_id, update, false, now)?;
                let alerts = emit_resume_budget_alert(conn, &budget)?;
                Ok(CommittedOutcome::with_alert_outcomes(budget, alerts))
            })
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn delete_budget(&self, id: &str, update: BudgetLifecycleUpdate) -> Result<()> {
        let deleted_at = self.clock.sample();
        let id = id.to_string();
        self.writer
            .exec(move |conn| delete_budget_in_storage(conn, &id, update, deleted_at))
            .await
    }
}

pub(super) fn parse_cadence(budget: &BudgetRow) -> Result<BudgetCadence> {
    budget
        .cadence
        .parse()
        .map_err(|_| Error::Repository("Invalid budget cadence".to_string()))
}
