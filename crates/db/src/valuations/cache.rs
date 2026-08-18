use crate::errors::IntoStorage;
use crate::transactions::models::TransactionRow;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Bool, Nullable, Text, Timestamp};
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::exchange_rates::{automatic_pair, legs_for_pair};
use zai_core::money::{CanonicalRate, ConversionRate, CurrencyCode, Money, convert};

use super::generation::active_generation;

#[derive(QueryableByName)]
struct RateRevisionRow {
    #[diesel(sql_type = Text)]
    id: String,
    #[diesel(sql_type = Text)]
    variant: String,
    #[diesel(sql_type = Nullable<Timestamp>)]
    rate_date: Option<chrono::NaiveDateTime>,
    #[diesel(sql_type = Nullable<Text>)]
    original_decimal: Option<String>,
}

pub(crate) fn upsert_transaction_valuation(
    conn: &mut SqliteConnection,
    transaction: &TransactionRow,
) -> Result<()> {
    let generation = active_generation(conn)?;
    upsert_transaction_valuation_row(
        conn,
        &generation.id,
        &generation.target_currency,
        transaction,
    )
}

pub(crate) fn upsert_transaction_valuation_row(
    conn: &mut SqliteConnection,
    generation_id: &str,
    target_currency: &str,
    transaction: &TransactionRow,
) -> Result<()> {
    let target = CurrencyCode::parse(target_currency)?;
    let source = Money::from_minor_units(transaction.amount, &transaction.currency)?;
    let revision = latest_rate_revision(conn, &transaction.id)?;
    let prior = generation_prior(conn, generation_id)?;
    let (amount, complete) =
        convert_for_generation(conn, source, target, prior, revision.as_ref())?;
    sql_query(
        "INSERT INTO transaction_valuations (\
            generation_id, transaction_id, transaction_date, converted_amount, \
            converted_currency, complete, rate_revision_id\
         ) VALUES (?, ?, ?, ?, ?, ?, ?) \
         ON CONFLICT(generation_id, transaction_id) DO UPDATE SET \
            transaction_date = excluded.transaction_date, \
            converted_amount = excluded.converted_amount, \
            converted_currency = excluded.converted_currency, \
            complete = excluded.complete, \
            rate_revision_id = excluded.rate_revision_id",
    )
    .bind::<Text, _>(generation_id)
    .bind::<Text, _>(&transaction.id)
    .bind::<Timestamp, _>(transaction.transaction_date)
    .bind::<Nullable<BigInt>, _>(amount)
    .bind::<Text, _>(target.as_str())
    .bind::<Bool, _>(complete)
    .bind::<Nullable<Text>, _>(revision.as_ref().map(|row| row.id.as_str()))
    .execute(conn)
    .into_storage()?;
    Ok(())
}

fn latest_rate_revision(
    conn: &mut SqliteConnection,
    transaction_id: &str,
) -> Result<Option<RateRevisionRow>> {
    sql_query(
        "SELECT id, variant, rate_date, original_decimal \
         FROM transaction_exchange_rate_revisions \
         WHERE transaction_id = ? \
         ORDER BY sequence DESC \
         LIMIT 1",
    )
    .bind::<Text, _>(transaction_id)
    .get_result::<RateRevisionRow>(conn)
    .optional()
    .into_storage()
    .map_err(Into::into)
}

fn convert_for_generation(
    conn: &mut SqliteConnection,
    source: Money,
    target: CurrencyCode,
    prior: Option<CurrencyCode>,
    revision: Option<&RateRevisionRow>,
) -> Result<(Option<i64>, bool)> {
    if source.currency() == target {
        return Ok((Some(source.minor_units()), true));
    }
    match revision.map(|row| row.variant.as_str()) {
        Some("pending") | None => Ok((None, false)),
        Some("manual") => {
            let decimal = revision
                .and_then(|row| row.original_decimal.as_deref())
                .ok_or_else(|| {
                    zai_core::Error::InvalidData("Manual rate is missing its decimal".to_string())
                })?;
            let quoted_to = prior.unwrap_or(target);
            let via_prior = convert(
                source,
                quoted_to,
                &ConversionRate::Manual(CanonicalRate::parse(decimal)?),
            )?;
            let Some(in_prior) = via_prior.converted else {
                return Ok((None, false));
            };
            if quoted_to == target {
                return Ok((Some(in_prior.minor_units()), true));
            }
            let restated = convert(
                in_prior,
                target,
                &pair_or_pending(conn, quoted_to, target, revision)?,
            )?;
            Ok((
                restated.converted.map(|money| money.minor_units()),
                restated.complete,
            ))
        }
        Some("identity") | Some("automatic") => {
            let converted = convert(
                source,
                target,
                &pair_or_pending(conn, source.currency(), target, revision)?,
            )?;
            Ok((
                converted.converted.map(|money| money.minor_units()),
                converted.complete,
            ))
        }
        Some(other) => Err(zai_core::Error::InvalidData(format!(
            "Unknown exchange-rate variant {other}"
        ))),
    }
}

fn pair_or_pending(
    conn: &mut SqliteConnection,
    source: CurrencyCode,
    target: CurrencyCode,
    revision: Option<&RateRevisionRow>,
) -> Result<ConversionRate> {
    let value_date = revision
        .and_then(|row| row.rate_date.map(|value| value.date()))
        .unwrap_or_else(|| chrono::Utc::now().date_naive());
    let Some(accepted) = crate::exchange_rates::current_accepted_set(conn)? else {
        return Ok(ConversionRate::Pending {
            rate_date: value_date,
        });
    };
    match legs_for_pair(&accepted, source, target, value_date) {
        Ok((source_leg, target_leg)) => automatic_pair(&accepted.id, source_leg, target_leg),
        Err(_) => Ok(ConversionRate::Pending {
            rate_date: value_date,
        }),
    }
}

fn generation_prior(
    conn: &mut SqliteConnection,
    generation_id: &str,
) -> Result<Option<CurrencyCode>> {
    #[derive(QueryableByName)]
    struct PriorRow {
        #[diesel(sql_type = Nullable<Text>)]
        prior_currency: Option<String>,
    }
    let row = sql_query("SELECT prior_currency FROM valuation_generations WHERE id = ?")
        .bind::<Text, _>(generation_id)
        .get_result::<PriorRow>(conn)
        .optional()
        .into_storage()?;
    row.and_then(|row| row.prior_currency)
        .map(|code| CurrencyCode::parse(&code))
        .transpose()
}
