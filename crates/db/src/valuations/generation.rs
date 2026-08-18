use super::ActiveGeneration;
use super::cache::upsert_transaction_valuation_row;
use crate::errors::IntoStorage;
use crate::schema::transactions;
use crate::transactions::models::TransactionRow;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{Integer, Nullable, Text, Timestamp};
use diesel::sqlite::SqliteConnection;
use uuid::Uuid;
use zai_core::Result;
use zai_core::money::CurrencyCode;

#[cfg(test)]
pub(crate) const INITIAL_ACTUAL_GENERATION_ID: &str = "val-actual-1";

#[derive(QueryableByName)]
struct GenerationRow {
    #[diesel(sql_type = Text)]
    id: String,
    #[diesel(sql_type = Text)]
    target_currency: String,
    #[diesel(sql_type = Integer)]
    default_currency_revision: i32,
}

pub(crate) fn active_generation(conn: &mut SqliteConnection) -> Result<ActiveGeneration> {
    let row = sql_query(
        "SELECT g.id, g.target_currency, g.default_currency_revision \
         FROM valuation_heads h \
         JOIN valuation_generations g ON g.id = h.generation_id \
         WHERE h.kind = 'actual'",
    )
    .get_result::<GenerationRow>(conn)
    .into_storage()?;
    Ok(ActiveGeneration {
        id: row.id,
        target_currency: row.target_currency,
        revision: row.default_currency_revision,
    })
}

pub(crate) fn current_allowance_currency(conn: &mut SqliteConnection) -> Result<String> {
    Ok(active_generation(conn)?.target_currency)
}

pub(crate) fn change_default_currency(
    conn: &mut SqliteConnection,
    target: CurrencyCode,
    now: NaiveDateTime,
) -> Result<ActiveGeneration> {
    let current = active_generation(conn)?;
    if current.target_currency == target.as_str() {
        return Ok(current);
    }
    let built = build_actual_generation(conn, target, Some(&current.target_currency), now)?;
    activate_generation(conn, &built.id, target, now)?;
    crate::budgets::timeline::rebuild_all_results(conn).map_err(zai_core::Error::from)?;
    active_generation(conn)
}

pub(crate) fn build_actual_generation(
    conn: &mut SqliteConnection,
    target: CurrencyCode,
    prior_currency: Option<&str>,
    now: NaiveDateTime,
) -> Result<ActiveGeneration> {
    let current = active_generation(conn)?;
    let next_revision = current.revision + 1;
    let generation_id = format!("val-actual-{}", Uuid::new_v4());
    sql_query(
        "INSERT INTO valuation_generations (\
            id, kind, target_currency, prior_currency, default_currency_revision, \
            status, created_at, activated_at\
         ) VALUES (?, 'actual', ?, ?, ?, 'building', ?, NULL)",
    )
    .bind::<Text, _>(&generation_id)
    .bind::<Text, _>(target.as_str())
    .bind::<Nullable<Text>, _>(prior_currency)
    .bind::<Integer, _>(next_revision)
    .bind::<Timestamp, _>(now)
    .execute(conn)
    .into_storage()?;

    let rows = transactions::table
        .load::<TransactionRow>(conn)
        .into_storage()?;
    for transaction in rows {
        upsert_transaction_valuation_row(conn, &generation_id, target.as_str(), &transaction)?;
    }

    sql_query("UPDATE valuation_generations SET status = 'ready' WHERE id = ?")
        .bind::<Text, _>(&generation_id)
        .execute(conn)
        .into_storage()?;

    Ok(ActiveGeneration {
        id: generation_id,
        target_currency: target.as_str().to_string(),
        revision: next_revision,
    })
}

pub(crate) fn activate_generation(
    conn: &mut SqliteConnection,
    generation_id: &str,
    target: CurrencyCode,
    now: NaiveDateTime,
) -> Result<()> {
    let current = active_generation(conn)?;
    sql_query("UPDATE valuation_generations SET status = 'superseded' WHERE id = ?")
        .bind::<Text, _>(&current.id)
        .execute(conn)
        .into_storage()?;
    sql_query(
        "UPDATE valuation_generations \
         SET status = 'active', activated_at = ? \
         WHERE id = ?",
    )
    .bind::<Timestamp, _>(now)
    .bind::<Text, _>(generation_id)
    .execute(conn)
    .into_storage()?;
    sql_query(
        "UPDATE valuation_heads \
         SET generation_id = ?, switched_at = ? \
         WHERE kind = 'actual'",
    )
    .bind::<Text, _>(generation_id)
    .bind::<Timestamp, _>(now)
    .execute(conn)
    .into_storage()?;
    sql_query(
        "UPDATE currency_settings \
         SET default_currency = ?, default_currency_revision = default_currency_revision + 1 \
         WHERE id = 1",
    )
    .bind::<Text, _>(target.as_str())
    .execute(conn)
    .into_storage()?;
    Ok(())
}
