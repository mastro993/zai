use super::models::{BudgetConfigurationRow, BudgetPeriodResultRow, BudgetRow, build_budget};
use crate::connection::{DbPool, get_connection};
use crate::errors::{IntoCore, IntoStorage, StorageError};
use crate::schema::{
    self, budget_configurations, budget_period_results, budgets, transaction_categories,
};
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use chrono::{Local, NaiveDateTime};
use diesel::OptionalExtension;
use diesel::prelude::*;
use diesel::result::{DatabaseErrorKind, Error as DieselError};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::features::budgets::models::{
    Budget, BudgetCadence, BudgetMeasurementMode, CategoryHierarchy, NewBudget, calculate_period,
    canonicalize_category_ids, current_period, expand_category_scope,
};
use zai_core::features::budgets::traits::BudgetsRepositoryTrait;
use zai_core::{Error, Result};

pub struct BudgetsRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
}

impl BudgetsRepository {
    pub(crate) fn new(pool: Arc<DbPool>, writer: WriteHandle) -> Self {
        Self { pool, writer }
    }

    fn active_budget_ids(&self) -> Result<Vec<String>> {
        let conn = &mut get_connection(&self.pool)?;
        budgets::table
            .filter(budgets::deleted_at.is_null())
            .order(budgets::name.asc())
            .select(budgets::id)
            .load::<String>(conn)
            .into_core()
    }

    async fn rebuild_budget(&self, id: &str, now: NaiveDateTime) -> Result<Budget> {
        let id = id.to_string();

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<Budget> {
                    let budget = budgets::table
                        .filter(budgets::id.eq(&id))
                        .filter(budgets::deleted_at.is_null())
                        .first::<BudgetRow>(conn)
                        .into_storage()?;
                    let cadence = budget_cadence(&budget).map_err(StorageError::CoreError)?;
                    let (current_start, _) =
                        current_period(now, cadence).map_err(StorageError::CoreError)?;
                    let configuration = budget_configurations::table
                        .filter(budget_configurations::budget_id.eq(&id))
                        .order(budget_configurations::period_start.desc())
                        .first::<BudgetConfigurationRow>(conn)
                        .optional()
                        .into_storage()?;
                    let mut configuration = match configuration {
                        Some(configuration) => configuration,
                        None => {
                            let (_, period_end) =
                                current_period(now, cadence).map_err(StorageError::CoreError)?;
                            let configuration = BudgetConfigurationRow {
                                budget_id: id.clone(),
                                period_start: current_start,
                                period_end,
                                category_ids: "[]".to_string(),
                                base_allowance: budget.base_allowance,
                                measurement_mode: budget.measurement_mode.clone(),
                                rollover_mode: budget.rollover_mode.clone(),
                                warning_percentage: budget.warning_percentage,
                            };
                            diesel::insert_into(budget_configurations::table)
                                .values(&configuration)
                                .execute(conn)
                                .into_storage()?;
                            configuration
                        }
                    };
                    let category_ids = parse_category_ids(&configuration.category_ids)?;
                    let categories = load_category_hierarchy(conn)?;
                    let scope_ids = expand_category_scope(&category_ids, &categories);

                    if configuration.period_start > current_start {
                        return Err(StorageError::CoreError(Error::Conflict(
                            "Budget period is ahead of the local calendar clock".to_string(),
                        )));
                    }

                    let current_result = loop {
                        let net_budget_spending = calculate_spending(
                            conn,
                            configuration.period_start,
                            configuration.period_end,
                            configuration.measurement_mode.parse().map_err(|_| {
                                StorageError::CoreError(Error::Repository(
                                    "Invalid budget measurement mode".to_string(),
                                ))
                            })?,
                            &scope_ids,
                        )?;
                        let period = calculate_period(
                            configuration.period_start,
                            configuration.period_end,
                            configuration.base_allowance,
                            net_budget_spending,
                            configuration.warning_percentage,
                        )
                        .map_err(StorageError::CoreError)?;
                        let result = BudgetPeriodResultRow {
                            budget_id: id.clone(),
                            period_start: configuration.period_start,
                            period_end: configuration.period_end,
                            net_budget_spending: period.net_budget_spending,
                            effective_allowance: period.effective_allowance,
                            remaining_allowance: period.remaining_allowance,
                            status: status_string(period.status),
                        };
                        upsert_period_result(conn, &result)?;

                        if configuration.period_start == current_start {
                            break result;
                        }

                        let next_start = configuration.period_end;
                        let next_end = next_period_end(next_start, cadence)?;
                        configuration = BudgetConfigurationRow {
                            budget_id: id.clone(),
                            period_start: next_start,
                            period_end: next_end,
                            category_ids: configuration.category_ids.clone(),
                            base_allowance: configuration.base_allowance,
                            measurement_mode: configuration.measurement_mode.clone(),
                            rollover_mode: configuration.rollover_mode.clone(),
                            warning_percentage: configuration.warning_percentage,
                        };
                        diesel::insert_into(budget_configurations::table)
                            .values(&configuration)
                            .execute(conn)
                            .into_storage()?;
                    };

                    build_budget(budget, configuration, current_result)
                        .map_err(StorageError::CoreError)
                },
            )
            .await
    }
}

#[async_trait]
impl BudgetsRepositoryTrait for BudgetsRepository {
    async fn list_budgets(&self) -> Result<Vec<Budget>> {
        let ids = self.active_budget_ids()?;
        let now = Local::now().naive_local();
        let mut result = Vec::with_capacity(ids.len());
        for id in ids {
            result.push(self.rebuild_budget(&id, now).await?);
        }
        Ok(result)
    }

    async fn get_budget(&self, id: &str) -> Result<Budget> {
        self.rebuild_budget(id, Local::now().naive_local()).await
    }

    async fn create_budget(&self, budget: NewBudget) -> Result<Budget> {
        let id = budget
            .id
            .clone()
            .ok_or_else(|| Error::InvalidData("Budget id is required".to_string()))?;
        let now = Local::now().naive_local();
        let cadence = budget.cadence.unwrap_or_default();
        let (period_start, period_end) = current_period(now, cadence)?;
        let measurement_mode = budget.measurement_mode.unwrap_or_default();
        let warning_percentage = budget.warning_percentage;
        let base_allowance = budget.base_allowance;
        let name = budget.name;
        let selected_category_ids = budget.category_ids;

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<Budget> {
                    let categories = load_category_hierarchy(conn)?;
                    let category_ids =
                        canonicalize_category_ids(&selected_category_ids, &categories);
                    let scope_ids = expand_category_scope(&category_ids, &categories);
                    let net_budget_spending = calculate_spending(
                        conn,
                        period_start,
                        period_end,
                        measurement_mode,
                        &scope_ids,
                    )?;
                    let period = calculate_period(
                        period_start,
                        period_end,
                        base_allowance,
                        net_budget_spending,
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
                        rollover_mode: "off".to_string(),
                        warning_percentage,
                        created_at: timestamp,
                        updated_at: timestamp,
                        deleted_at: None,
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
                        rollover_mode: "off".to_string(),
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
                },
            )
            .await
    }
}

fn status_string(status: zai_core::features::budgets::models::BudgetStatus) -> String {
    match status {
        zai_core::features::budgets::models::BudgetStatus::OnTrack => "onTrack",
        zai_core::features::budgets::models::BudgetStatus::Warning => "warning",
        zai_core::features::budgets::models::BudgetStatus::Overspent => "overspent",
    }
    .to_string()
}

fn next_period_end(
    period_start: NaiveDateTime,
    cadence: BudgetCadence,
) -> crate::errors::Result<NaiveDateTime> {
    current_period(period_start, cadence)
        .map(|(_, end)| end)
        .map_err(StorageError::CoreError)
}

fn upsert_period_result(
    conn: &mut SqliteConnection,
    result: &BudgetPeriodResultRow,
) -> crate::errors::Result<()> {
    let changed = diesel::update(
        budget_period_results::table
            .filter(budget_period_results::budget_id.eq(&result.budget_id))
            .filter(budget_period_results::period_start.eq(result.period_start)),
    )
    .set((
        budget_period_results::period_end.eq(result.period_end),
        budget_period_results::net_budget_spending.eq(result.net_budget_spending),
        budget_period_results::effective_allowance.eq(result.effective_allowance),
        budget_period_results::remaining_allowance.eq(result.remaining_allowance),
        budget_period_results::status.eq(&result.status),
    ))
    .execute(conn)
    .into_storage()?;

    if changed == 0 {
        diesel::insert_into(budget_period_results::table)
            .values(result)
            .execute(conn)
            .into_storage()?;
    }

    Ok(())
}

fn map_budget_insert_error(error: DieselError) -> StorageError {
    match error {
        DieselError::DatabaseError(DatabaseErrorKind::UniqueViolation, _) => {
            StorageError::CoreError(Error::NameConflict(
                "An active budget with this name already exists".to_string(),
            ))
        }
        error => StorageError::from(error),
    }
}

fn calculate_spending(
    conn: &mut SqliteConnection,
    start: NaiveDateTime,
    end: NaiveDateTime,
    measurement_mode: BudgetMeasurementMode,
    scope_ids: &[String],
) -> crate::errors::Result<i64> {
    let mut query = schema::transactions::table
        .left_join(schema::transaction_categories::table)
        .filter(schema::transactions::deleted_at.is_null())
        .filter(schema::transactions::transaction_date.ge(start))
        .filter(schema::transactions::transaction_date.lt(end))
        .select((
            schema::transactions::amount,
            schema::transactions::transaction_type,
            schema::transactions::transaction_category_id,
            schema::transaction_categories::role.nullable(),
        ))
        .into_boxed();

    if !scope_ids.is_empty() {
        query = query.filter(schema::transactions::transaction_category_id.eq_any(scope_ids));
    }

    let transactions = query
        .load::<(i32, String, Option<String>, Option<String>)>(conn)
        .into_storage()?;

    transactions
        .into_iter()
        .try_fold(0_i64, |total, (amount, kind, _category_id, role)| {
            let contribution = match (kind.as_str(), measurement_mode) {
                ("expense", _) => i64::from(amount),
                ("income", BudgetMeasurementMode::NetCashFlow) => -i64::from(amount),
                ("income", BudgetMeasurementMode::Spending)
                    if role.as_deref() == Some("spending") =>
                {
                    -i64::from(amount)
                }
                _ => 0,
            };
            total.checked_add(contribution).ok_or_else(|| {
                StorageError::CoreError(Error::InvalidData(
                    "Budget calculation overflow".to_string(),
                ))
            })
        })
}

fn load_category_hierarchy(
    conn: &mut SqliteConnection,
) -> crate::errors::Result<Vec<CategoryHierarchy>> {
    transaction_categories::table
        .filter(transaction_categories::deleted_at.is_null())
        .select((
            transaction_categories::id,
            transaction_categories::parent_id,
        ))
        .load::<(String, Option<String>)>(conn)
        .into_storage()
        .map(|rows| {
            rows.into_iter()
                .map(|(id, parent_id)| CategoryHierarchy { id, parent_id })
                .collect()
        })
}

fn parse_category_ids(value: &str) -> crate::errors::Result<Vec<String>> {
    serde_json::from_str(value).map_err(|_| {
        StorageError::CoreError(Error::Repository(
            "Invalid budget category scope".to_string(),
        ))
    })
}

fn budget_cadence(budget: &BudgetRow) -> Result<BudgetCadence> {
    budget
        .cadence
        .parse()
        .map_err(|_| Error::Repository("Invalid budget cadence".to_string()))
}
