use crate::budgets::models::{BudgetConfigurationRow, BudgetRow};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::transaction_categories;
use crate::valuations::{SpendingAggregate, current_allowance_currency, sum_period_spending};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetMeasurementMode, BudgetPeriod, BudgetRolloverMode, CategoryHierarchy,
    current_period, expand_category_scope,
};
use zai_core::features::valuations::{
    PeriodCalculation, PeriodCompleteness, calculate_period_with_completeness,
};
use zai_core::money::{ConversionRate, CurrencyCode, Money};

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
    let spending = calculate_spending_aggregate(
        conn,
        configuration.period_start,
        configuration.period_end,
        measurement_mode,
        &scope_ids,
    )?;
    let converted_allowance = restate_configuration_allowance(conn, configuration)?;

    calculate_period_with_completeness(PeriodCalculation {
        start: configuration.period_start,
        end: configuration.period_end,
        authored_allowance: configuration.base_allowance,
        converted_allowance,
        net_budget_spending: spending.known_sum,
        rollover_mode,
        previous_period,
        warning_percentage: configuration.warning_percentage,
        completeness: PeriodCompleteness {
            spending_complete: spending.complete,
            allowance_complete: converted_allowance.is_some(),
        },
    })
    .map_err(StorageError::CoreError)
}

pub(crate) fn calculate_spending(
    conn: &mut SqliteConnection,
    start: NaiveDateTime,
    end: NaiveDateTime,
    measurement_mode: BudgetMeasurementMode,
    scope_ids: &[String],
) -> crate::errors::Result<i64> {
    Ok(sum_period_spending(conn, start, end, measurement_mode, scope_ids)?.known_sum)
}

pub(crate) fn calculate_spending_aggregate(
    conn: &mut SqliteConnection,
    start: NaiveDateTime,
    end: NaiveDateTime,
    measurement_mode: BudgetMeasurementMode,
    scope_ids: &[String],
) -> crate::errors::Result<SpendingAggregate> {
    sum_period_spending(conn, start, end, measurement_mode, scope_ids)
}

fn restate_configuration_allowance(
    conn: &mut SqliteConnection,
    configuration: &BudgetConfigurationRow,
) -> crate::errors::Result<Option<i64>> {
    let target = current_allowance_currency(conn).map_err(StorageError::from)?;
    let authored =
        CurrencyCode::parse(&configuration.allowance_currency).map_err(StorageError::from)?;
    let target_code = CurrencyCode::parse(&target).map_err(StorageError::from)?;
    if authored == target_code {
        return Ok(Some(configuration.base_allowance));
    }
    let money = Money::new(configuration.base_allowance, authored).map_err(StorageError::from)?;
    let rate = period_start_rate(
        conn,
        authored,
        target_code,
        configuration.period_start.date(),
    )?;
    let restated =
        zai_core::features::valuations::restate_authored_allowance(money, target_code, &rate)
            .map_err(StorageError::from)?;
    Ok(restated.converted.map(|value| value.minor_units()))
}

fn period_start_rate(
    conn: &mut SqliteConnection,
    source: CurrencyCode,
    target: CurrencyCode,
    value_date: chrono::NaiveDate,
) -> crate::errors::Result<ConversionRate> {
    if source == target {
        return Ok(ConversionRate::Identity);
    }
    let Some(accepted) =
        crate::exchange_rates::current_accepted_set(conn).map_err(StorageError::from)?
    else {
        return Ok(ConversionRate::Pending {
            rate_date: value_date,
        });
    };
    match zai_core::features::exchange_rates::legs_for_pair(&accepted, source, target, value_date) {
        Ok((source_leg, target_leg)) => {
            zai_core::features::exchange_rates::automatic_pair(&accepted.id, source_leg, target_leg)
                .map_err(StorageError::from)
        }
        Err(_) => Ok(ConversionRate::Pending {
            rate_date: value_date,
        }),
    }
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

pub(super) fn parse_category_ids(value: &str) -> crate::errors::Result<Vec<String>> {
    serde_json::from_str(value).map_err(|_| invalid_budget("Invalid budget category scope"))
}

pub(super) fn parse_cadence(budget: &BudgetRow) -> crate::errors::Result<BudgetCadence> {
    budget
        .cadence
        .parse()
        .map_err(|_| invalid_budget("Invalid budget cadence"))
}

pub(super) fn invalid_budget(message: &str) -> StorageError {
    StorageError::CoreError(Error::Repository(message.to_string()))
}

pub(crate) fn status_string(status: zai_core::features::budgets::models::BudgetStatus) -> String {
    match status {
        zai_core::features::budgets::models::BudgetStatus::OnTrack => "onTrack",
        zai_core::features::budgets::models::BudgetStatus::Warning => "warning",
        zai_core::features::budgets::models::BudgetStatus::Overspent => "overspent",
    }
    .to_string()
}
