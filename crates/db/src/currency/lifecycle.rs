use crate::connection::{DbPool, get_connection};
use crate::errors::IntoCore;
use crate::exchange_rates::current_accepted_set;
use chrono::{NaiveDate, Utc};
use diesel::prelude::QueryableByName;
use diesel::sql_query;
use diesel::sql_types::{Nullable, Text, Timestamp};
use diesel::{OptionalExtension, RunQueryDsl, sqlite::SqliteConnection};
use zai_core::features::currency::{ExchangeRateQuote, QuoteVariant};
use zai_core::features::exchange_rates::{
    APPROVED_ECB_CURRENCIES, automatic_pair, is_approved_ecb_currency, legs_for_pair,
    pair_attribution,
};
use zai_core::money::{CURRENT_MANIFEST, CurrencyCode, Money, convert};
use zai_core::{Error, Result};

#[derive(QueryableByName)]
struct FlagRow {
    #[diesel(sql_type = Nullable<Timestamp>)]
    accepted_at: Option<chrono::NaiveDateTime>,
}

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    count: i64,
}

#[derive(QueryableByName)]
struct ObservationBoundRow {
    #[diesel(sql_type = Nullable<Text>)]
    first_date: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    last_date: Option<String>,
}

pub fn enable_currency(pool: &DbPool, currency_code: &str) -> Result<()> {
    let mut connection = get_connection(pool)?;
    let now = Utc::now().naive_utc();
    sql_query(
        "INSERT INTO enabled_currencies (code, enabled_at, disabled_at) \
         VALUES (?, ?, NULL) \
         ON CONFLICT(code) DO UPDATE SET disabled_at = NULL",
    )
    .bind::<Text, _>(currency_code)
    .bind::<Timestamp, _>(now)
    .execute(&mut connection)
    .into_core()?;
    Ok(())
}

pub fn disable_currency(pool: &DbPool, currency_code: &str) -> Result<()> {
    let mut connection = get_connection(pool)?;
    let now = Utc::now().naive_utc();
    let updated = sql_query(
        "UPDATE enabled_currencies SET disabled_at = ? WHERE code = ? AND disabled_at IS NULL",
    )
    .bind::<Timestamp, _>(now)
    .bind::<Text, _>(currency_code)
    .execute(&mut connection)
    .into_core()?;
    if updated == 0 {
        return Err(Error::NotFound(format!("Currency {currency_code}")));
    }
    Ok(())
}

pub fn prove_coverage(pool: &DbPool, currency_code: &str) -> Result<()> {
    let mut connection = get_connection(pool)?;
    prove_coverage_on(&mut connection, currency_code)
}

fn prove_coverage_on(connection: &mut SqliteConnection, currency_code: &str) -> Result<()> {
    if currency_code == "EUR" {
        return Ok(());
    }
    let currency = CurrencyCode::parse(currency_code)?;
    if !is_approved_ecb_currency(currency) {
        return Ok(());
    }
    let Some(set) = current_accepted_set(connection)? else {
        return Err(Error::IncompleteCoverage {
            missing_periods: vec!["ECB history unavailable".to_string()],
        });
    };
    let present = set
        .observations
        .iter()
        .any(|observation| observation.currency.as_str() == currency_code);
    if present {
        Ok(())
    } else {
        Err(Error::IncompleteCoverage {
            missing_periods: vec![format!("{currency_code} historical coverage")],
        })
    }
}

pub fn provider_disclosure_accepted(pool: &DbPool) -> Result<bool> {
    let mut connection = get_connection(pool)?;
    let row = sql_query(
        "SELECT provider_disclosure_accepted_at AS accepted_at FROM currency_settings WHERE id = 1",
    )
    .get_result::<FlagRow>(&mut connection)
    .into_core()?;
    Ok(row.accepted_at.is_some())
}

pub fn accept_provider_disclosure(pool: &DbPool) -> Result<()> {
    let mut connection = get_connection(pool)?;
    let now = Utc::now().naive_utc();
    sql_query(
        "UPDATE currency_settings SET provider_disclosure_accepted_at = \
         COALESCE(provider_disclosure_accepted_at, ?) WHERE id = 1",
    )
    .bind::<Timestamp, _>(now)
    .execute(&mut connection)
    .into_core()?;
    Ok(())
}

pub fn has_ecb_retained_data(pool: &DbPool) -> Result<bool> {
    let mut connection = get_connection(pool)?;
    if current_accepted_set(&mut connection)?.is_some() {
        return Ok(true);
    }
    let list = approved_ecb_sql_list();
    let count = sql_query(format!(
        "SELECT COUNT(*) AS count FROM enabled_currencies \
         WHERE code != 'EUR' AND code IN ({list})"
    ))
    .get_result::<CountRow>(&mut connection)
    .into_core()?
    .count;
    Ok(count > 0)
}

pub fn begin_default_generation(pool: &DbPool, currency_code: &str) -> Result<String> {
    let currency = CurrencyCode::parse(currency_code)?;
    let mut connection = get_connection(pool)?;
    let now = Utc::now().naive_utc();
    let current = crate::valuations::active_generation(&mut connection)?;
    let built = crate::valuations::build_actual_generation(
        &mut connection,
        currency,
        Some(&current.target_currency),
        now,
    )?;
    Ok(built.id)
}

pub fn activate_default_generation(
    pool: &DbPool,
    generation_id: &str,
    currency_code: &str,
) -> Result<()> {
    let currency = CurrencyCode::parse(currency_code)?;
    let mut connection = get_connection(pool)?;
    let now = Utc::now().naive_utc();
    connection
        .immediate_transaction(|connection| {
            crate::valuations::activate_generation(connection, generation_id, currency, now)
                .map_err(crate::errors::StorageError::from)?;
            crate::budgets::timeline::rebuild_all_results(connection)?;
            crate::errors::Result::Ok(())
        })
        .into_core()
}

pub fn attach_generation(pool: &DbPool, job_id: &str, generation_id: &str) -> Result<()> {
    let mut connection = get_connection(pool)?;
    sql_query("UPDATE currency_jobs SET generation_id = ? WHERE id = ?")
        .bind::<Text, _>(generation_id)
        .bind::<Text, _>(job_id)
        .execute(&mut connection)
        .into_core()?;
    Ok(())
}

pub fn quote(
    pool: &DbPool,
    source: &str,
    target: &str,
    rate_date: &str,
) -> Result<ExchangeRateQuote> {
    let source = CurrencyCode::parse(source)?;
    let target = CurrencyCode::parse(target)?;
    let parsed_date = NaiveDate::parse_from_str(rate_date, "%Y-%m-%d")
        .map_err(|_| Error::InvalidData(format!("Invalid quote date: {rate_date}")))?;
    if source.as_str() == target.as_str() {
        return Ok(ExchangeRateQuote {
            source_currency: source.as_str().to_string(),
            target_currency: target.as_str().to_string(),
            rate_date: rate_date.to_string(),
            variant: QuoteVariant::Identity,
            rate: Some("1".to_string()),
            attribution: None,
            complete: true,
        });
    }
    let mut connection = get_connection(pool)?;
    let Some(set) = current_accepted_set(&mut connection)? else {
        return Ok(pending_quote(source, target, rate_date));
    };
    match legs_for_pair(&set, source, target, parsed_date) {
        Ok((source_obs, target_obs)) => {
            let pair = automatic_pair(&set.id, source_obs, target_obs)?;
            let one = Money::new(
                10_i64.pow(u32::from(CURRENT_MANIFEST.record(source).minor_unit_digits)),
                source,
            )?;
            let conversion = convert(one, target, &pair)?;
            let rate = conversion.converted.map(format_major_units);
            Ok(ExchangeRateQuote {
                source_currency: source.as_str().to_string(),
                target_currency: target.as_str().to_string(),
                rate_date: rate_date.to_string(),
                variant: QuoteVariant::Automatic,
                rate,
                attribution: Some(pair_attribution(source, target).to_string()),
                complete: conversion.complete,
            })
        }
        Err(_) => Ok(pending_quote(source, target, rate_date)),
    }
}

pub fn observation_bounds(
    connection: &mut SqliteConnection,
    currency_code: &str,
) -> Result<Option<(String, String)>> {
    sql_query(
        "SELECT MIN(o.value_date) AS first_date, MAX(o.value_date) AS last_date \
         FROM provider_heads h \
         JOIN provider_rate_observations o ON o.rate_set_id = h.rate_set_id \
         WHERE h.id = 1 AND o.currency = ?",
    )
    .bind::<Text, _>(currency_code)
    .get_result::<ObservationBoundRow>(connection)
    .optional()
    .into_core()
    .map(|row| {
        row.and_then(|value| match (value.first_date, value.last_date) {
            (Some(from), Some(to)) => Some((from, to)),
            _ => None,
        })
    })
}

fn format_major_units(money: Money) -> String {
    let digits = usize::from(money.minor_unit_digits());
    let minor = money.minor_units();
    if digits == 0 {
        return minor.to_string();
    }
    let scale = 10_i64.pow(digits as u32);
    format!(
        "{}.{:0width$}",
        minor / scale,
        minor % scale,
        width = digits
    )
}

fn pending_quote(source: CurrencyCode, target: CurrencyCode, rate_date: &str) -> ExchangeRateQuote {
    ExchangeRateQuote {
        source_currency: source.as_str().to_string(),
        target_currency: target.as_str().to_string(),
        rate_date: rate_date.to_string(),
        variant: QuoteVariant::Pending,
        rate: None,
        attribution: None,
        complete: false,
    }
}

pub fn approved_ecb_sql_list() -> String {
    APPROVED_ECB_CURRENCIES
        .iter()
        .map(|code| format!("'{code}'"))
        .collect::<Vec<_>>()
        .join(",")
}
