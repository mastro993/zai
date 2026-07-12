use super::calculation::{
    calculate_spending, load_category_hierarchy, map_budget_insert_error, status_string,
};
use super::edit::update_budget as update_budget_in_storage;
use super::history::load_history;
use super::lifecycle::set_budget_paused;
use super::models::{BudgetConfigurationRow, BudgetPeriodResultRow, BudgetRow, build_budget};
use super::projection::materialize_budget;
use crate::connection::{DbPool, get_connection};
use crate::errors::{IntoCore, IntoStorage, StorageError};
use crate::schema::{budget_configurations, budget_period_results, budgets};
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use diesel::OptionalExtension;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::features::budgets::models::{
    Budget, BudgetCadence, BudgetLifecycleUpdate, BudgetListFilter, BudgetPeriodHistory,
    BudgetUpdate, NewBudget, calculate_period_with_rollover, canonicalize_category_ids,
    current_period, expand_category_scope,
};
use zai_core::features::budgets::traits::{BudgetsRepositoryTrait, CalendarClock};
use zai_core::{Error, Result};

pub struct BudgetsRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
    clock: Arc<dyn CalendarClock>,
}

impl BudgetsRepository {
    #[cfg(test)]
    pub(crate) fn new(pool: Arc<DbPool>, writer: WriteHandle) -> Self {
        Self::new_with_clock(
            pool,
            writer,
            Arc::new(zai_core::features::budgets::traits::LocalCalendarClock),
        )
    }

    pub(crate) fn new_with_clock(
        pool: Arc<DbPool>,
        writer: WriteHandle,
        clock: Arc<dyn CalendarClock>,
    ) -> Self {
        Self {
            pool,
            writer,
            clock,
        }
    }

    fn budget_ids(&self, filter: BudgetListFilter) -> Result<Vec<String>> {
        let query = budgets::table
            .filter(budgets::deleted_at.is_null())
            .into_boxed();
        let query = match filter {
            BudgetListFilter::Active => query.filter(budgets::paused.eq(false)),
            BudgetListFilter::Paused => query.filter(budgets::paused.eq(true)),
            BudgetListFilter::All => query,
        };
        query
            .order((budgets::name.asc(), budgets::id.asc()))
            .select(budgets::id)
            .load::<String>(&mut get_connection(&self.pool)?)
            .into_core()
    }

    fn projected_budget(&self, id: &str, now: NaiveDateTime) -> Result<ProjectionState> {
        let mut conn = get_connection(&self.pool)?;
        projected_budget_from_connection(&mut conn, id, now).into_core()
    }

    async fn get_or_materialize(&self, id: &str, now: NaiveDateTime) -> Result<Budget> {
        match self.projected_budget(id, now)? {
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

pub(super) fn projected_budget_from_connection(
    conn: &mut SqliteConnection,
    id: &str,
    now: NaiveDateTime,
) -> crate::errors::Result<ProjectionState> {
    let budget = budgets::table
        .filter(budgets::id.eq(id))
        .filter(budgets::deleted_at.is_null())
        .first::<BudgetRow>(conn)
        .into_storage()?;
    let cadence = parse_cadence(&budget).map_err(StorageError::CoreError)?;
    let (current_start, _) = current_period(now, cadence).map_err(StorageError::CoreError)?;
    let configuration = budget_configurations::table
        .filter(budget_configurations::budget_id.eq(id))
        .order(budget_configurations::period_start.desc())
        .first::<BudgetConfigurationRow>(conn)
        .optional()
        .into_storage()?;
    let Some(configuration) = configuration else {
        return Ok(ProjectionState::NeedsMaterialization);
    };
    let configuration_count = budget_configurations::table
        .filter(budget_configurations::budget_id.eq(id))
        .count()
        .get_result::<i64>(conn)
        .into_storage()?;
    let result_count = budget_period_results::table
        .filter(budget_period_results::budget_id.eq(id))
        .count()
        .get_result::<i64>(conn)
        .into_storage()?;
    if configuration_count != result_count {
        return Ok(ProjectionState::NeedsMaterialization);
    }
    if configuration.period_start > current_start {
        return Err(StorageError::CoreError(Error::ClockRegression(
            "Budget period is ahead of the local calendar clock".to_string(),
        )));
    }
    let Some(result) = budget_period_results::table
        .filter(budget_period_results::budget_id.eq(id))
        .filter(budget_period_results::period_start.eq(configuration.period_start))
        .first::<BudgetPeriodResultRow>(conn)
        .optional()
        .into_storage()?
    else {
        return Ok(ProjectionState::NeedsMaterialization);
    };
    if configuration.period_start != current_start {
        return Ok(ProjectionState::NeedsMaterialization);
    }
    build_budget(budget, configuration, result)
        .map(ProjectionState::Current)
        .map_err(StorageError::CoreError)
}

pub(super) enum ProjectionState {
    Current(Budget),
    NeedsMaterialization,
}

#[async_trait]
impl BudgetsRepositoryTrait for BudgetsRepository {
    async fn list_budgets(&self, filter: BudgetListFilter) -> Result<Vec<Budget>> {
        let now = self.clock.sample();
        let ids = self.budget_ids(filter)?;
        let mut result = Vec::with_capacity(ids.len());
        for id in ids {
            result.push(self.get_or_materialize(&id, now).await?);
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
        let mut conn = get_connection(&self.pool)?;
        load_history(&mut conn, id, page, per_page)
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
        let id = id.to_string();
        self.writer
            .exec(move |conn| update_budget_in_storage(conn, &id, update, now))
            .await
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
        let id = id.to_string();
        self.writer
            .exec(move |conn| set_budget_paused(conn, &id, update, false, now))
            .await
    }
}

pub(super) fn parse_cadence(budget: &BudgetRow) -> Result<BudgetCadence> {
    budget
        .cadence
        .parse()
        .map_err(|_| Error::Repository("Invalid budget cadence".to_string()))
}
