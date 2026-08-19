use crate::errors::IntoStorage;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Text, Timestamp};
use diesel::sqlite::SqliteConnection;
use zai_core::features::budgets::models::BudgetMeasurementMode;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SpendingAggregate {
    pub known_sum: i64,
    pub complete: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(not(test), allow(dead_code))]
pub enum SpendingBucketGrain {
    Day,
    Month,
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(not(test), allow(dead_code))]
pub struct SpendingBucket {
    pub bucket_start: NaiveDateTime,
    pub known_sum: i64,
    pub complete: bool,
}

#[derive(QueryableByName)]
struct SpendingRow {
    #[diesel(sql_type = BigInt)]
    known_sum: i64,
    #[diesel(sql_type = BigInt)]
    incomplete_count: i64,
}

#[derive(QueryableByName)]
#[cfg_attr(not(test), allow(dead_code))]
struct SpendingBucketRow {
    #[diesel(sql_type = Text)]
    bucket_start: String,
    #[diesel(sql_type = BigInt)]
    known_sum: i64,
    #[diesel(sql_type = BigInt)]
    incomplete_count: i64,
}

const SPENDING_AMOUNT: &str = "\
CASE \
    WHEN t.transaction_type = 'expense' THEN COALESCE(tv.converted_amount, 0) \
    WHEN t.transaction_type = 'income' AND ? = 'netCashFlow' THEN -COALESCE(tv.converted_amount, 0) \
    WHEN t.transaction_type = 'income' AND ? = 'spending' AND tc.role = 'spending' \
        THEN -COALESCE(tv.converted_amount, 0) \
    ELSE 0 \
END";

const SPENDING_FROM: &str = "\
FROM valuation_heads h \
JOIN transaction_valuations tv ON tv.generation_id = h.generation_id \
JOIN transactions t ON t.id = tv.transaction_id \
LEFT JOIN transaction_categories tc ON tc.id = t.transaction_category_id \
WHERE h.kind = 'actual' \
  AND t.deleted_at IS NULL \
  AND (? = '[]' OR t.transaction_category_id IN (SELECT value FROM json_each(?))) \
  AND t.transaction_date >= ? \
  AND t.transaction_date < ?";

pub(crate) fn sum_period_spending(
    conn: &mut SqliteConnection,
    start: chrono::NaiveDateTime,
    end: chrono::NaiveDateTime,
    measurement_mode: BudgetMeasurementMode,
    scope_ids: &[String],
) -> crate::errors::Result<SpendingAggregate> {
    let sql = format!(
        "SELECT COALESCE(SUM({SPENDING_AMOUNT}), 0) AS known_sum, \
         COALESCE(SUM(CASE WHEN tv.complete = 0 THEN 1 ELSE 0 END), 0) AS incomplete_count \
         {SPENDING_FROM}"
    );
    let (mode, scope) = spending_binds(measurement_mode, scope_ids)?;
    let row = sql_query(sql)
        .bind::<Text, _>(mode)
        .bind::<Text, _>(mode)
        .bind::<Text, _>(&scope)
        .bind::<Text, _>(&scope)
        .bind::<Timestamp, _>(start)
        .bind::<Timestamp, _>(end)
        .get_result::<SpendingRow>(conn)
        .into_storage()?;
    Ok(SpendingAggregate {
        known_sum: row.known_sum,
        complete: row.incomplete_count == 0,
    })
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn sum_spending_buckets(
    conn: &mut SqliteConnection,
    start: chrono::NaiveDateTime,
    end: chrono::NaiveDateTime,
    measurement_mode: BudgetMeasurementMode,
    scope_ids: &[String],
    grain: SpendingBucketGrain,
) -> crate::errors::Result<Vec<SpendingBucket>> {
    let bucket_expr = match grain {
        SpendingBucketGrain::Day => "strftime('%Y-%m-%d', t.transaction_date)",
        SpendingBucketGrain::Month => "strftime('%Y-%m-01', t.transaction_date)",
    };
    let sql = format!(
        "SELECT {bucket_expr} AS bucket_start, \
         COALESCE(SUM({SPENDING_AMOUNT}), 0) AS known_sum, \
         COALESCE(SUM(CASE WHEN tv.complete = 0 THEN 1 ELSE 0 END), 0) AS incomplete_count \
         {SPENDING_FROM} \
         GROUP BY {bucket_expr} \
         ORDER BY {bucket_expr}"
    );
    let (mode, scope) = spending_binds(measurement_mode, scope_ids)?;
    let rows = sql_query(sql)
        .bind::<Text, _>(mode)
        .bind::<Text, _>(mode)
        .bind::<Text, _>(&scope)
        .bind::<Text, _>(&scope)
        .bind::<Timestamp, _>(start)
        .bind::<Timestamp, _>(end)
        .load::<SpendingBucketRow>(conn)
        .into_storage()?;
    rows.into_iter().map(parse_bucket_row).collect()
}

fn spending_binds(
    measurement_mode: BudgetMeasurementMode,
    scope_ids: &[String],
) -> crate::errors::Result<(&'static str, String)> {
    let scope = serde_json::to_string(scope_ids).map_err(|error| {
        crate::errors::StorageError::CoreError(zai_core::Error::InvalidData(format!(
            "Invalid budget category scope: {error}"
        )))
    })?;
    Ok((measurement_mode.as_str(), scope))
}

#[cfg_attr(not(test), allow(dead_code))]
fn parse_bucket_row(row: SpendingBucketRow) -> crate::errors::Result<SpendingBucket> {
    let date = chrono::NaiveDate::parse_from_str(&row.bucket_start, "%Y-%m-%d").map_err(|_| {
        crate::errors::StorageError::CoreError(zai_core::Error::InvalidData(format!(
            "Invalid spending bucket start: {}",
            row.bucket_start
        )))
    })?;
    let bucket_start = date.and_hms_opt(0, 0, 0).ok_or_else(|| {
        crate::errors::StorageError::CoreError(zai_core::Error::InvalidData(
            "Invalid spending bucket midnight".to_string(),
        ))
    })?;
    Ok(SpendingBucket {
        bucket_start,
        known_sum: row.known_sum,
        complete: row.incomplete_count == 0,
    })
}
