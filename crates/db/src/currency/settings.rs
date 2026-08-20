use crate::connection::{DbPool, get_connection};
use crate::errors::IntoCore;
use diesel::RunQueryDsl;
use diesel::prelude::QueryableByName;
use diesel::sql_query;
use diesel::sql_types::{Bool, Integer, Nullable, Text, Timestamp};
use zai_core::Result;
use zai_core::features::currency::{CurrencyRefreshStatus, PersistedCurrency};

#[derive(QueryableByName)]
struct PersistedRow {
    #[diesel(sql_type = Text)]
    code: String,
    #[diesel(sql_type = Bool)]
    disabled: bool,
    #[diesel(sql_type = Bool)]
    used_by_recurring: bool,
}

#[derive(QueryableByName)]
struct RefreshRow {
    #[diesel(sql_type = Nullable<Timestamp>)]
    last_success_at: Option<chrono::NaiveDateTime>,
    #[diesel(sql_type = Nullable<Timestamp>)]
    last_attempt_at: Option<chrono::NaiveDateTime>,
    #[diesel(sql_type = Nullable<Text>)]
    failure_class: Option<String>,
    #[diesel(sql_type = Integer)]
    retry_count: i32,
}

pub fn list_persisted(pool: &DbPool) -> Result<Vec<PersistedCurrency>> {
    let mut connection = get_connection(pool)?;
    let rows = sql_query(
        "SELECT e.code AS code, \
                (e.disabled_at IS NOT NULL) AS disabled, \
                EXISTS ( \
                    SELECT 1 \
                    FROM recurring_template_revisions rtr \
                    INNER JOIN recurring_transactions rt \
                        ON rt.id = rtr.recurring_transaction_id \
                    WHERE rtr.currency = e.code \
                      AND rt.deleted_at IS NULL \
                ) AS used_by_recurring \
         FROM enabled_currencies e \
         ORDER BY e.code",
    )
    .load::<PersistedRow>(&mut connection)
    .into_core()?;
    let refresh = sql_query(
        "SELECT last_success_at, last_attempt_at, failure_class, retry_count \
         FROM provider_refresh_state WHERE id = 1",
    )
    .get_result::<RefreshRow>(&mut connection)
    .into_core()?;
    let last_refresh = refresh
        .last_success_at
        .or(refresh.last_attempt_at)
        .map(|value| value.and_utc().to_rfc3339());
    let refresh_status = refresh_status(&refresh);
    let mut currencies = Vec::with_capacity(rows.len());
    for row in rows {
        let bounds = super::lifecycle::observation_bounds(&mut connection, &row.code)?;
        let (coverage_from, coverage_to) = match bounds {
            Some((from, to)) => (Some(from), Some(to)),
            None if row.code == "EUR" => (None, None),
            None => (None, None),
        };
        currencies.push(PersistedCurrency {
            code: row.code,
            disabled: row.disabled,
            used_by_recurring: row.used_by_recurring,
            coverage_from,
            coverage_to,
            last_refresh: last_refresh.clone(),
            refresh_status,
            missing_periods: Vec::new(),
        });
    }
    Ok(currencies)
}

fn refresh_status(row: &RefreshRow) -> CurrencyRefreshStatus {
    if row.last_attempt_at.is_none() {
        return CurrencyRefreshStatus::Idle;
    }
    if row.failure_class.is_none() {
        return CurrencyRefreshStatus::Fresh;
    }
    if row.retry_count > 1 {
        CurrencyRefreshStatus::Failed
    } else {
        CurrencyRefreshStatus::Stale
    }
}
