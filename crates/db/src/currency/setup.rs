use crate::connection::{DbPool, get_connection};
use crate::errors::IntoCore;
use chrono::Utc;
use diesel::prelude::QueryableByName;
use diesel::sql_query;
use diesel::sql_types::{Integer, Nullable, Text, Timestamp};
use diesel::{RunQueryDsl, sqlite::SqliteConnection};
use uuid::Uuid;
use zai_core::money::{CONVERSION_FORMULA_VERSION, CurrencyCode};
use zai_core::{Error, Result};

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    count: i64,
}

#[derive(QueryableByName)]
struct CurrencyRow {
    #[diesel(sql_type = Text)]
    default_currency: String,
    #[diesel(sql_type = Nullable<Timestamp>)]
    setup_completed_at: Option<chrono::NaiveDateTime>,
    #[diesel(sql_type = Integer)]
    default_currency_revision: i32,
}

pub fn setup_state(pool: &DbPool) -> Result<(String, bool)> {
    let mut connection = get_connection(pool)?;
    let settings = read_settings(&mut connection)?;
    Ok((
        settings.default_currency,
        settings.setup_completed_at.is_some(),
    ))
}

pub fn require_setup(pool: &DbPool) -> Result<()> {
    let mut connection = get_connection(pool)?;
    require_setup_on_connection(&mut connection)
}

pub fn require_setup_on_connection(connection: &mut SqliteConnection) -> Result<()> {
    if read_settings(connection)?.setup_completed_at.is_some() {
        Ok(())
    } else {
        Err(Error::SetupRequired)
    }
}

pub fn setup_is_complete(pool: &DbPool) -> Result<bool> {
    let mut connection = get_connection(pool)?;
    Ok(read_settings(&mut connection)?.setup_completed_at.is_some())
}

pub fn default_currency(connection: &mut SqliteConnection) -> Result<String> {
    Ok(read_settings(connection)?.default_currency)
}

pub fn default_currency_revision(pool: &DbPool) -> Result<i32> {
    let mut connection = get_connection(pool)?;
    Ok(read_settings(&mut connection)?.default_currency_revision)
}

pub fn complete_initial_setup(pool: &DbPool, currency_code: &str) -> Result<()> {
    let currency = CurrencyCode::parse(currency_code)?;
    let code = currency.as_str();
    let mut connection = get_connection(pool)?;
    let settings = read_settings(&mut connection)?;
    if let Some(_completed_at) = settings.setup_completed_at {
        if settings.default_currency == code {
            return Ok(());
        }
        return Err(Error::Conflict(
            "Initial currency setup is already complete".to_string(),
        ));
    }

    let now = Utc::now().naive_utc();
    connection
        .immediate_transaction(|connection| {
            sql_query(
                "INSERT INTO enabled_currencies (code, enabled_at, disabled_at) \
                 VALUES (?, ?, NULL) \
                 ON CONFLICT(code) DO UPDATE SET disabled_at = NULL",
            )
            .bind::<Text, _>(code)
            .bind::<Timestamp, _>(now)
            .execute(connection)?;
            let active = crate::valuations::active_generation(connection)
                .map_err(crate::errors::StorageError::from)?;
            if active.target_currency != code {
                crate::valuations::change_default_currency(connection, currency, now)
                    .map_err(crate::errors::StorageError::from)?;
            } else {
                sql_query(
                    "UPDATE currency_settings \
                     SET default_currency = ? \
                     WHERE id = 1",
                )
                .bind::<Text, _>(code)
                .execute(connection)?;
            }
            sql_query("UPDATE currency_settings SET setup_completed_at = ? WHERE id = 1")
                .bind::<Timestamp, _>(now)
                .execute(connection)?;
            crate::errors::Result::Ok(())
        })
        .into_core()
}

pub fn insert_identity_rate(
    connection: &mut SqliteConnection,
    transaction_id: &str,
    rate_date: chrono::NaiveDateTime,
) -> Result<()> {
    let existing = sql_query(
        "SELECT COUNT(*) AS count FROM transaction_exchange_rate_revisions \
         WHERE transaction_id = ?",
    )
    .bind::<Text, _>(transaction_id)
    .get_result::<CountRow>(connection)
    .into_core()?
    .count;
    if existing > 0 {
        return Ok(());
    }
    sql_query(
        "INSERT INTO transaction_exchange_rate_revisions (\
            id, transaction_id, sequence, variant, rate_date, \
            original_decimal, coefficient, scale, formula_version, created_at\
         ) VALUES (?, ?, 1, 'identity', ?, NULL, NULL, NULL, ?, ?)",
    )
    .bind::<Text, _>(format!("txr-{transaction_id}-{}", Uuid::new_v4()))
    .bind::<Text, _>(transaction_id)
    .bind::<Timestamp, _>(rate_date)
    .bind::<diesel::sql_types::Integer, _>(i32::try_from(CONVERSION_FORMULA_VERSION).unwrap_or(1))
    .bind::<Timestamp, _>(Utc::now().naive_utc())
    .execute(connection)
    .into_core()?;
    Ok(())
}

fn read_settings(connection: &mut SqliteConnection) -> Result<CurrencyRow> {
    sql_query(
        "SELECT default_currency, setup_completed_at, default_currency_revision \
         FROM currency_settings WHERE id = 1",
    )
    .get_result::<CurrencyRow>(connection)
    .into_core()
}
