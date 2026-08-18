use crate::errors::IntoStorage;
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

#[derive(QueryableByName)]
struct SpendingRow {
    #[diesel(sql_type = BigInt)]
    known_sum: i64,
    #[diesel(sql_type = BigInt)]
    incomplete_count: i64,
}

const SPENDING_SQL: &str = "\
SELECT COALESCE(SUM(\
    CASE \
        WHEN t.transaction_type = 'expense' THEN COALESCE(tv.converted_amount, 0) \
        WHEN t.transaction_type = 'income' AND ? = 'netCashFlow' THEN -COALESCE(tv.converted_amount, 0) \
        WHEN t.transaction_type = 'income' AND ? = 'spending' AND tc.role = 'spending' \
            THEN -COALESCE(tv.converted_amount, 0) \
        ELSE 0 \
    END\
), 0) AS known_sum, \
COALESCE(SUM(CASE WHEN tv.complete = 0 THEN 1 ELSE 0 END), 0) AS incomplete_count \
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
    let mode = measurement_mode.as_str();
    let scope = serde_json::to_string(scope_ids).map_err(|error| {
        crate::errors::StorageError::CoreError(zai_core::Error::InvalidData(format!(
            "Invalid budget category scope: {error}"
        )))
    })?;
    let row = sql_query(SPENDING_SQL)
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
