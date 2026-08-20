use crate::errors::IntoStorage;
use crate::transactions::models::TransactionRow;
use chrono::NaiveDateTime;
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
    rate_date: Option<NaiveDateTime>,
    #[diesel(sql_type = Nullable<Text>)]
    original_decimal: Option<String>,
    #[diesel(sql_type = Timestamp)]
    created_at: NaiveDateTime,
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
    let context = generation_quote_context(conn, generation_id)?;
    let (amount, complete) =
        convert_for_generation(conn, source, target, context, revision.as_ref())?;
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
        "SELECT id, variant, rate_date, original_decimal, created_at \
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
    context: GenerationQuoteContext,
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
            let quoted_to = manual_quote_currency(
                source.currency(),
                target,
                context.prior,
                revision
                    .map(|row| row.created_at)
                    .unwrap_or(context.created_at),
                context.created_at,
            );
            let via_quote = convert(
                source,
                quoted_to,
                &ConversionRate::Manual(CanonicalRate::parse(decimal)?),
            )?;
            let Some(in_quote) = via_quote.converted else {
                return Ok((None, false));
            };
            if quoted_to == target {
                return Ok((Some(in_quote.minor_units()), true));
            }
            let restated = convert(
                in_quote,
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

struct GenerationQuoteContext {
    prior: Option<CurrencyCode>,
    created_at: NaiveDateTime,
}

fn generation_quote_context(
    conn: &mut SqliteConnection,
    generation_id: &str,
) -> Result<GenerationQuoteContext> {
    #[derive(QueryableByName)]
    struct ContextRow {
        #[diesel(sql_type = Nullable<Text>)]
        prior_currency: Option<String>,
        #[diesel(sql_type = Timestamp)]
        created_at: NaiveDateTime,
    }
    let row =
        sql_query("SELECT prior_currency, created_at FROM valuation_generations WHERE id = ?")
            .bind::<Text, _>(generation_id)
            .get_result::<ContextRow>(conn)
            .into_storage()?;
    Ok(GenerationQuoteContext {
        prior: row
            .prior_currency
            .map(|code| CurrencyCode::parse(&code))
            .transpose()?,
        created_at: row.created_at,
    })
}

/// Manual rates lock source→default at write time.
/// Revisions written in this generation quote the current target.
/// Older revisions quote `prior` (the previous default) and restate via pair.
/// If that quote currency equals the source (EUR→RUB→EUR then a RUB txn),
/// fall back to the current target — same-currency manuals are identity, not stored.
fn manual_quote_currency(
    source: CurrencyCode,
    target: CurrencyCode,
    prior: Option<CurrencyCode>,
    revision_created_at: NaiveDateTime,
    generation_created_at: NaiveDateTime,
) -> CurrencyCode {
    let quoted_to = if revision_created_at >= generation_created_at {
        target
    } else {
        prior.unwrap_or(target)
    };
    if quoted_to == source {
        target
    } else {
        quoted_to
    }
}

#[cfg(test)]
mod quote_currency_tests {
    use super::manual_quote_currency;
    use chrono::{TimeZone, Utc};
    use zai_core::money::CurrencyCode;

    fn code(raw: &str) -> CurrencyCode {
        CurrencyCode::parse(raw).expect("code")
    }

    fn at(hour: u32) -> chrono::NaiveDateTime {
        Utc.with_ymd_and_hms(2026, 8, 18, hour, 0, 0)
            .unwrap()
            .naive_utc()
    }

    #[test]
    fn current_generation_manual_quotes_active_target() {
        assert_eq!(
            manual_quote_currency(code("USD"), code("EUR"), Some(code("USD")), at(14), at(12)),
            code("EUR")
        );
    }

    #[test]
    fn restated_manual_quotes_prior_default() {
        assert_eq!(
            manual_quote_currency(code("USD"), code("GBP"), Some(code("EUR")), at(10), at(12)),
            code("EUR")
        );
    }

    #[test]
    fn source_equal_prior_falls_back_to_target() {
        assert_eq!(
            manual_quote_currency(code("RUB"), code("EUR"), Some(code("RUB")), at(10), at(12)),
            code("EUR")
        );
    }
}
