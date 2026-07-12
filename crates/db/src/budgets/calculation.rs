use super::models::{BudgetConfigurationRow, BudgetRow};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{self, transaction_categories};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::result::{DatabaseErrorKind, Error as DieselError};
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetMeasurementMode, BudgetPeriod, BudgetRolloverMode, CategoryHierarchy,
    calculate_period_with_rollover, current_period, expand_category_scope,
};

pub(super) const MAX_PERIOD_ADVANCE: i64 = 2_000;

pub(super) fn calculate_configuration(
    conn: &mut SqliteConnection,
    configuration: &BudgetConfigurationRow,
    categories: &[CategoryHierarchy],
    previous_period: Option<&BudgetPeriod>,
) -> crate::errors::Result<BudgetPeriod> {
    let category_ids = parse_category_ids(&configuration.category_ids)?;
    let scope_ids = expand_category_scope(&category_ids, categories);
    let measurement_mode = configuration
        .measurement_mode
        .parse::<BudgetMeasurementMode>()
        .map_err(|_| invalid_budget("Invalid budget measurement mode"))?;
    let rollover_mode = configuration
        .rollover_mode
        .parse::<BudgetRolloverMode>()
        .map_err(|_| invalid_budget("Invalid budget rollover mode"))?;
    let spending = calculate_spending(
        conn,
        configuration.period_start,
        configuration.period_end,
        measurement_mode,
        &scope_ids,
    )?;

    calculate_period_with_rollover(
        configuration.period_start,
        configuration.period_end,
        configuration.base_allowance,
        spending,
        rollover_mode,
        previous_period,
        configuration.warning_percentage,
    )
    .map_err(StorageError::CoreError)
}

pub(super) fn calculate_spending(
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
            schema::transaction_categories::role.nullable(),
        ))
        .into_boxed();

    if !scope_ids.is_empty() {
        query = query.filter(schema::transactions::transaction_category_id.eq_any(scope_ids));
    }

    query
        .load::<(i32, String, Option<String>)>(conn)
        .into_storage()?
        .into_iter()
        .try_fold(0_i64, |total, (amount, kind, role)| {
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

pub(super) fn count_missing_periods(
    configuration: &BudgetConfigurationRow,
    current_start: NaiveDateTime,
    cadence: BudgetCadence,
) -> crate::errors::Result<i64> {
    let mut count = 0;
    let mut period_start = configuration.period_start;
    while period_start < current_start {
        count += 1;
        if count > MAX_PERIOD_ADVANCE {
            return Err(StorageError::CoreError(Error::PeriodAdvanceLimitExceeded(
                "Budget period advance exceeds the 2,000-period limit".to_string(),
            )));
        }
        period_start = next_period_end(period_start, cadence)?;
    }
    Ok(count)
}

pub(super) fn next_period(
    configuration: &BudgetConfigurationRow,
    cadence: BudgetCadence,
) -> crate::errors::Result<(NaiveDateTime, NaiveDateTime)> {
    let start = configuration.period_end;
    let end = next_period_end(start, cadence)?;
    Ok((start, end))
}

pub(super) fn next_period_end(
    period_start: NaiveDateTime,
    cadence: BudgetCadence,
) -> crate::errors::Result<NaiveDateTime> {
    current_period(period_start, cadence)
        .map(|(_, end)| end)
        .map_err(StorageError::CoreError)
}

pub(super) fn validate_period_boundaries(
    configuration: &BudgetConfigurationRow,
    cadence: BudgetCadence,
) -> crate::errors::Result<()> {
    let expected_end = current_period(configuration.period_start, cadence)
        .map_err(StorageError::CoreError)?
        .1;
    if configuration.period_start >= configuration.period_end
        || expected_end != configuration.period_end
    {
        return Err(invalid_budget(
            "Budget period start must precede period end",
        ));
    }
    Ok(())
}

pub(crate) fn load_category_hierarchy(
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

pub(crate) fn parse_category_ids(value: &str) -> crate::errors::Result<Vec<String>> {
    serde_json::from_str(value).map_err(|_| invalid_budget("Invalid budget category scope"))
}

pub(crate) fn parse_cadence(budget: &BudgetRow) -> crate::errors::Result<BudgetCadence> {
    budget
        .cadence
        .parse()
        .map_err(|_| invalid_budget("Invalid budget cadence"))
}

pub(super) fn invalid_budget(message: &str) -> StorageError {
    StorageError::CoreError(Error::Repository(message.to_string()))
}

pub(super) fn status_string(status: zai_core::features::budgets::models::BudgetStatus) -> String {
    match status {
        zai_core::features::budgets::models::BudgetStatus::OnTrack => "onTrack",
        zai_core::features::budgets::models::BudgetStatus::Warning => "warning",
        zai_core::features::budgets::models::BudgetStatus::Overspent => "overspent",
    }
    .to_string()
}

pub(super) fn map_budget_insert_error(error: DieselError) -> StorageError {
    match error {
        DieselError::DatabaseError(DatabaseErrorKind::UniqueViolation, _) => {
            StorageError::CoreError(Error::NameConflict(
                "An active budget with this name already exists".to_string(),
            ))
        }
        error => StorageError::from(error),
    }
}
