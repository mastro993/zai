use super::alerts::{
    emit_budget_transition_alerts, emit_resume_budget_alert, snapshot_budgets_by_ids,
};
use super::calculation::{
    calculate_spending, load_category_hierarchy, map_budget_insert_error, status_string,
};
use super::edit::update_budget as update_budget_in_storage;
use super::history::load_history;
use super::lifecycle::{delete_budget as delete_budget_in_storage, set_budget_paused};
use super::list_projection::{
    ProjectionState, project_budget_list, projected_budget_from_connection,
};
use super::models::{BudgetConfigurationRow, BudgetPeriodResultRow, BudgetRow, build_budget};
use super::projection::materialize_budget;
use crate::blocking::run_blocking;
use crate::connection::{DbPool, get_connection};
use crate::errors::{IntoCore, IntoStorage, StorageError};
use crate::schema::{budget_configurations, budget_period_results, budgets};
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use std::sync::Arc;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::budgets::models::{
    Budget, BudgetCadence, BudgetLifecycleUpdate, BudgetListFilter, BudgetPeriodHistory,
    BudgetUpdate, NewBudget, calculate_period_with_rollover, canonicalize_category_ids,
    current_period, expand_category_scope,
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

    async fn get_or_materialize(&self, id: &str, now: NaiveDateTime) -> Result<Budget> {
        let pool = Arc::clone(&self.pool);
        let id_owned = id.to_owned();
        let state = run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            projected_budget_from_connection(&mut conn, &id_owned, now).into_core()
        })
        .await?;

        match state {
            ProjectionState::Current(budget) => Ok(budget),
            ProjectionState::NeedsMaterialization => {
                let id = id.to_string();
                self.writer
                    .exec(move |conn| materialize_budget(conn, &id, now))
                    .await
            }
        }
    }
}

#[async_trait]
impl BudgetsRepositoryTrait for BudgetsRepository {
    async fn list_budgets(&self, filter: BudgetListFilter) -> Result<Vec<Budget>> {
        let now = self.clock.sample();
        let pool = Arc::clone(&self.pool);
        let projected = run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            project_budget_list(&mut conn, filter, now).into_core()
        })
        .await?;

        let mut result = Vec::with_capacity(projected.len());
        for (id, state) in projected {
            match state {
                ProjectionState::Current(budget) => result.push(budget),
                ProjectionState::NeedsMaterialization => {
                    let id = id.clone();
                    result.push(
                        self.writer
                            .exec(move |conn| materialize_budget(conn, &id, now))
                            .await?,
                    );
                }
            }
        }
        Ok(result)
    }

    async fn get_budget(&self, id: &str) -> Result<Budget> {
        self.get_or_materialize(id, self.clock.sample()).await
    }

    async fn get_budget_history(
        &self,
        id: &str,
        page: i64,
        per_page: i64,
    ) -> Result<BudgetPeriodHistory> {
        zai_core::features::budgets::models::validate_history_paging(page, per_page)?;
        let now = self.clock.sample();
        self.get_or_materialize(id, now).await?;
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
        let (period_start, period_end) = current_period(now, cadence)?;
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
                let scope_ids = expand_category_scope(&category_ids, &categories);
                let spending = calculate_spending(
                    conn,
                    period_start,
                    period_end,
                    measurement_mode,
                    &scope_ids,
                )?;
                let period = calculate_period_with_rollover(
                    period_start,
                    period_end,
                    base_allowance,
                    spending,
                    rollover_mode,
                    None,
                    warning_percentage,
                )
                .map_err(StorageError::CoreError)?;
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
                let configuration = BudgetConfigurationRow {
                    budget_id: id.clone(),
                    period_start,
                    period_end,
                    category_ids: serde_json::to_string(&category_ids).map_err(|error| {
                        StorageError::CoreError(Error::InvalidData(format!(
                            "Invalid budget category scope: {error}"
                        )))
                    })?,
                    base_allowance,
                    measurement_mode: measurement_mode.to_string(),
                    rollover_mode: rollover_mode.to_string(),
                    warning_percentage,
                };
                diesel::insert_into(budget_configurations::table)
                    .values(&configuration)
                    .execute(conn)
                    .into_storage()?;
                let result = BudgetPeriodResultRow {
                    budget_id: id,
                    period_start,
                    period_end,
                    net_budget_spending: period.net_budget_spending,
                    effective_allowance: period.effective_allowance,
                    remaining_allowance: period.remaining_allowance,
                    status: status_string(period.status),
                };
                diesel::insert_into(budget_period_results::table)
                    .values(&result)
                    .execute(conn)
                    .into_storage()?;
                build_budget(budget_row, configuration, result).map_err(StorageError::CoreError)
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
