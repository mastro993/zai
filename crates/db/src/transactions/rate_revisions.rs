use chrono::{NaiveDate, NaiveDateTime};
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Bool, Integer, Nullable, Text, Timestamp};
use diesel::sqlite::SqliteConnection;
use std::collections::HashMap;
use uuid::Uuid;
use zai_core::Result;
use zai_core::features::currency::QuoteVariant;
use zai_core::features::transactions::import_models::ImportRatePlan;
use zai_core::features::transactions::models::{
    RateOrigin, RateVariant, Transaction, TransactionExchangeRateRevision, TransactionListItem,
    TransactionUpdate,
};
use zai_core::features::transactions::rate_write::{
    RateWriteDecision, RateWriteInput, decide_rate_write,
};
use zai_core::money::{
    CONVERSION_FORMULA_VERSION, CanonicalRate, CurrencyCode, RateVariantKind, WIRE_MAX_MINOR_UNITS,
};
use zai_core::{Error, money};

use super::models::TransactionRow;
use crate::errors::IntoStorage;
use crate::valuations::active_generation;

#[derive(QueryableByName)]
struct SequenceRow {
    #[diesel(sql_type = Integer)]
    sequence: i32,
}

#[derive(QueryableByName, Clone)]
pub(crate) struct StoredRateRevision {
    #[diesel(sql_type = Text)]
    variant: String,
    #[diesel(sql_type = Nullable<Timestamp>)]
    rate_date: Option<NaiveDateTime>,
    #[diesel(sql_type = Nullable<Text>)]
    original_decimal: Option<String>,
    #[diesel(sql_type = Nullable<BigInt>)]
    coefficient: Option<i64>,
    #[diesel(sql_type = Nullable<Integer>)]
    scale: Option<i32>,
    #[diesel(sql_type = Integer)]
    formula_version: i32,
}

#[derive(QueryableByName)]
struct ValuationRow {
    #[diesel(sql_type = Text)]
    transaction_id: String,
    #[diesel(sql_type = Nullable<BigInt>)]
    converted_amount: Option<i64>,
    #[diesel(sql_type = Text)]
    converted_currency: String,
    #[diesel(sql_type = Bool)]
    complete: bool,
}

pub(crate) fn latest_rate_revision(
    conn: &mut SqliteConnection,
    transaction_id: &str,
) -> Result<Option<StoredRateRevision>> {
    sql_query(
        "SELECT variant, rate_date, original_decimal, coefficient, scale, formula_version \
         FROM transaction_exchange_rate_revisions \
         WHERE transaction_id = ? \
         ORDER BY sequence DESC \
         LIMIT 1",
    )
    .bind::<Text, _>(transaction_id)
    .get_result::<StoredRateRevision>(conn)
    .optional()
    .into_storage()
    .map_err(Into::into)
}

pub(crate) fn apply_create_rate(
    conn: &mut SqliteConnection,
    row: &TransactionRow,
    manual_exchange_rate: Option<&str>,
) -> Result<()> {
    let target = crate::currency::default_currency(conn)?;
    apply_rate_write(
        conn,
        &row.id,
        RateWriteInput {
            source_currency: &row.currency,
            target_currency: &target,
            date_changed: false,
            currency_changed: false,
            has_manual_rate: manual_exchange_rate.is_some(),
            confirm_manual_replacement: false,
            retry_rate_lookup: false,
            existing_variant: None,
        },
        row.transaction_date,
        &target,
        manual_exchange_rate,
    )
}

pub(crate) fn apply_import_rate(
    conn: &mut SqliteConnection,
    row: &TransactionRow,
    plan: &ImportRatePlan,
) -> Result<()> {
    let target = crate::currency::default_currency(conn)?;
    match plan {
        ImportRatePlan::Lookup => apply_create_rate(conn, row, None),
        ImportRatePlan::Manual { decimal, rate_date } => append_revision(
            conn,
            &row.id,
            rate_date.unwrap_or(row.transaction_date),
            "manual",
            Some(&CanonicalRate::parse(decimal)?),
        ),
        ImportRatePlan::Identity => {
            append_revision(conn, &row.id, row.transaction_date, "identity", None)
        }
        ImportRatePlan::Pending { rate_date } => {
            append_revision(conn, &row.id, *rate_date, "pending", None)
        }
        ImportRatePlan::Automatic {
            decimal,
            rate_date,
            formula_version: _,
        } => restore_automatic_rate(conn, &row.id, &row.currency, &target, decimal, *rate_date),
    }
}

fn restore_automatic_rate(
    conn: &mut SqliteConnection,
    transaction_id: &str,
    source: &str,
    target: &str,
    decimal: &str,
    rate_date: NaiveDateTime,
) -> Result<()> {
    let source_code = CurrencyCode::parse(source)?;
    let target_code = CurrencyCode::parse(target)?;
    let date_text = rate_date.date().format("%Y-%m-%d").to_string();
    let parsed_date = NaiveDate::parse_from_str(&date_text, "%Y-%m-%d")
        .map_err(|_| Error::InvalidData(format!("Invalid rate date: {date_text}")))?;
    let quote = crate::currency::quote_on(conn, source_code, target_code, parsed_date, &date_text)?;
    let quoted = quote.rate.as_deref().filter(|value| !value.is_empty());
    let matches_evidence = matches!(quote.variant, QuoteVariant::Automatic)
        && quoted.is_some_and(|value| rates_match(value, decimal));
    if !matches_evidence {
        return Err(Error::InvalidData(
            "Automatic provenance could not be restored from provider evidence".to_string(),
        ));
    }
    append_revision(
        conn,
        transaction_id,
        rate_date,
        "automatic",
        Some(&CanonicalRate::parse(decimal)?),
    )
}

fn rates_match(quoted: &str, expected: &str) -> bool {
    let Ok(left) = CanonicalRate::parse(quoted) else {
        return false;
    };
    let Ok(right) = CanonicalRate::parse(expected) else {
        return false;
    };
    let Some(left_value) = i128::from(left.coefficient()).checked_mul(10_i128.pow(right.scale()))
    else {
        return false;
    };
    let Some(right_value) = i128::from(right.coefficient()).checked_mul(10_i128.pow(left.scale()))
    else {
        return false;
    };
    left_value == right_value
}

pub(crate) fn apply_update_rate(
    conn: &mut SqliteConnection,
    existing: &TransactionRow,
    update: &TransactionUpdate,
    persisted: &TransactionRow,
) -> Result<()> {
    let target = crate::currency::default_currency(conn)?;
    let existing_variant = latest_rate_revision(conn, &existing.id)?
        .as_ref()
        .map(StoredRateRevision::kind);
    apply_rate_write(
        conn,
        &persisted.id,
        RateWriteInput {
            source_currency: &persisted.currency,
            target_currency: &target,
            date_changed: existing.transaction_date.date() != persisted.transaction_date.date(),
            currency_changed: existing.currency != persisted.currency,
            has_manual_rate: update.manual_exchange_rate.is_some(),
            confirm_manual_replacement: update.confirm_manual_rate_replacement,
            retry_rate_lookup: update.retry_rate_lookup,
            existing_variant,
        },
        persisted.transaction_date,
        &target,
        update.manual_exchange_rate.as_deref(),
    )
}

fn apply_rate_write(
    conn: &mut SqliteConnection,
    transaction_id: &str,
    input: RateWriteInput<'_>,
    rate_date: NaiveDateTime,
    target_currency: &str,
    manual_exchange_rate: Option<&str>,
) -> Result<()> {
    match decide_rate_write(input) {
        RateWriteDecision::KeepCurrent => Ok(()),
        RateWriteDecision::RefuseManualReplacement => {
            let current = latest_rate_revision(conn, transaction_id)?
                .ok_or_else(|| Error::InvalidData("Missing exchange-rate revision".to_string()))?;
            let dto = current.into_dto(input.source_currency, target_currency);
            Err(Error::ManualRateReplacementRequired {
                current_revision: serde_json::to_value(dto).unwrap_or(serde_json::Value::Null),
            })
        }
        RateWriteDecision::AppendIdentity => {
            append_revision(conn, transaction_id, rate_date, "identity", None)
        }
        RateWriteDecision::AppendManual => {
            let decimal = manual_exchange_rate.ok_or_else(|| {
                Error::InvalidData("Manual exchange rate is required".to_string())
            })?;
            append_revision(
                conn,
                transaction_id,
                rate_date,
                "manual",
                Some(&CanonicalRate::parse(decimal)?),
            )
        }
        RateWriteDecision::AppendLookup => append_lookup(
            conn,
            transaction_id,
            rate_date,
            input.source_currency,
            target_currency,
        ),
    }
}

fn append_lookup(
    conn: &mut SqliteConnection,
    transaction_id: &str,
    rate_date: NaiveDateTime,
    source: &str,
    target: &str,
) -> Result<()> {
    let source_code = CurrencyCode::parse(source)?;
    let target_code = CurrencyCode::parse(target)?;
    let date_text = rate_date.date().format("%Y-%m-%d").to_string();
    let parsed_date = NaiveDate::parse_from_str(&date_text, "%Y-%m-%d")
        .map_err(|_| Error::InvalidData(format!("Invalid rate date: {date_text}")))?;
    let quote = crate::currency::quote_on(conn, source_code, target_code, parsed_date, &date_text)?;
    match quote.variant {
        QuoteVariant::Identity => {
            append_revision(conn, transaction_id, rate_date, "identity", None)
        }
        QuoteVariant::Pending => append_revision(conn, transaction_id, rate_date, "pending", None),
        QuoteVariant::Automatic => {
            let decimal = quote.rate.ok_or_else(|| {
                Error::InvalidData("Automatic quote is missing its rate".to_string())
            })?;
            append_revision(
                conn,
                transaction_id,
                rate_date,
                "automatic",
                Some(&CanonicalRate::parse(&decimal)?),
            )
        }
    }
}

fn append_revision(
    conn: &mut SqliteConnection,
    transaction_id: &str,
    rate_date: NaiveDateTime,
    variant: &str,
    rate: Option<&CanonicalRate>,
) -> Result<()> {
    let next = next_sequence(conn, transaction_id)?;
    let (decimal, coefficient, scale) = match rate {
        Some(rate) => (
            Some(rate.original_decimal().to_string()),
            Some(rate.coefficient()),
            Some(wire_i32(rate.scale(), "Exchange-rate scale")?),
        ),
        None => (None, None, None),
    };
    sql_query(
        "INSERT INTO transaction_exchange_rate_revisions (\
            id, transaction_id, sequence, variant, rate_date, \
            original_decimal, coefficient, scale, formula_version, created_at\
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind::<Text, _>(format!("txr-{transaction_id}-{}", Uuid::new_v4()))
    .bind::<Text, _>(transaction_id)
    .bind::<Integer, _>(next)
    .bind::<Text, _>(variant)
    .bind::<Timestamp, _>(rate_date)
    .bind::<Nullable<Text>, _>(decimal.as_deref())
    .bind::<Nullable<BigInt>, _>(coefficient)
    .bind::<Nullable<Integer>, _>(scale)
    .bind::<Integer, _>(wire_i32(
        CONVERSION_FORMULA_VERSION,
        "Conversion formula version",
    )?)
    .bind::<Timestamp, _>(chrono::Utc::now().naive_utc())
    .execute(conn)
    .into_storage()?;
    Ok(())
}

fn next_sequence(conn: &mut SqliteConnection, transaction_id: &str) -> Result<i32> {
    let current = sql_query(
        "SELECT COALESCE(MAX(sequence), 0) AS sequence \
         FROM transaction_exchange_rate_revisions WHERE transaction_id = ?",
    )
    .bind::<Text, _>(transaction_id)
    .get_result::<SequenceRow>(conn)
    .into_storage()?
    .sequence;
    Ok(current + 1)
}

impl StoredRateRevision {
    fn kind(&self) -> RateVariantKind {
        match self.variant.as_str() {
            "manual" => RateVariantKind::Manual,
            "automatic" => RateVariantKind::Automatic,
            "pending" => RateVariantKind::Pending,
            _ => RateVariantKind::Identity,
        }
    }

    fn formula_version_u32(&self) -> u32 {
        u32::try_from(self.formula_version).unwrap_or(CONVERSION_FORMULA_VERSION)
    }

    pub(crate) fn into_dto(
        self,
        source_currency: &str,
        reference_currency: &str,
    ) -> TransactionExchangeRateRevision {
        let rate_date = self
            .rate_date
            .map(|value| value.date().format("%Y-%m-%d").to_string())
            .unwrap_or_default();
        let variant = match self.variant.as_str() {
            "automatic" => RateVariant::Automatic,
            "manual" => RateVariant::Manual,
            "pending" => RateVariant::Pending,
            _ => RateVariant::Identity,
        };
        let origin = if matches!(variant, RateVariant::Manual) {
            RateOrigin::Manual
        } else {
            RateOrigin::Supplied
        };
        let source_observation_date =
            matches!(variant, RateVariant::Automatic).then(|| rate_date.clone());
        let identity = matches!(variant, RateVariant::Identity).then(CanonicalRate::one);
        TransactionExchangeRateRevision {
            variant,
            rate_date,
            source_observation_date,
            source_currency: source_currency.to_string(),
            reference_currency: reference_currency.to_string(),
            original_decimal: self.original_decimal.or_else(|| {
                identity
                    .as_ref()
                    .map(|rate| rate.original_decimal().to_string())
            }),
            coefficient: self
                .coefficient
                .or_else(|| identity.as_ref().map(CanonicalRate::coefficient)),
            scale: self
                .scale
                .and_then(|value| u32::try_from(value).ok())
                .or_else(|| identity.as_ref().map(CanonicalRate::scale)),
            origin,
        }
    }
}

pub(crate) fn transaction_detail(
    conn: &mut SqliteConnection,
    row: TransactionRow,
) -> Result<Transaction> {
    let generation = active_generation(conn)?;
    let revision = latest_rate_revision(conn, &row.id)?
        .unwrap_or_else(|| StoredRateRevision {
            variant: "identity".to_string(),
            rate_date: Some(row.transaction_date),
            original_decimal: None,
            coefficient: None,
            scale: None,
            formula_version: i32::try_from(CONVERSION_FORMULA_VERSION).unwrap_or(1),
        })
        .into_dto(&row.currency, &generation.target_currency);
    let valuation = load_valuations(conn, &generation.id, std::slice::from_ref(&row.id))?
        .into_iter()
        .next();
    let (converted_amount, converted_currency, complete) = match valuation {
        Some((_, amount, currency, complete)) => (amount, currency, complete),
        None => (None, generation.target_currency, false),
    };
    Ok(Transaction {
        id: row.id,
        description: row.description,
        amount: wire_minor(row.amount)?,
        currency: row.currency,
        transaction_date: row.transaction_date,
        transaction_type: row.transaction_type,
        transaction_category_id: row.transaction_category_id,
        notes: row.notes,
        exchange_rate: revision,
        converted_amount,
        converted_currency,
        complete,
    })
}

pub(crate) fn transaction_list_items(
    conn: &mut SqliteConnection,
    rows: Vec<TransactionRow>,
) -> Result<Vec<TransactionListItem>> {
    if rows.is_empty() {
        return Ok(Vec::new());
    }
    let generation = active_generation(conn)?;
    let ids = rows.iter().map(|row| row.id.clone()).collect::<Vec<_>>();
    let valuations = load_valuations(conn, &generation.id, &ids)?;
    let mut by_id = valuations
        .into_iter()
        .map(|(id, amount, currency, complete)| (id, (amount, currency, complete)))
        .collect::<std::collections::HashMap<_, _>>();
    rows.into_iter()
        .map(|row| {
            let (converted_amount, converted_currency, complete) = by_id
                .remove(&row.id)
                .unwrap_or((None, generation.target_currency.clone(), false));
            Ok(TransactionListItem {
                id: row.id,
                description: row.description,
                transaction_date: row.transaction_date,
                transaction_type: row.transaction_type,
                transaction_category_id: row.transaction_category_id,
                notes: row.notes,
                converted_amount,
                converted_currency,
                complete,
            })
        })
        .collect()
}

#[derive(QueryableByName)]
struct ExportRateRow {
    #[diesel(sql_type = Text)]
    transaction_id: String,
    #[diesel(sql_type = Integer)]
    sequence: i32,
    #[diesel(sql_type = Text)]
    variant: String,
    #[diesel(sql_type = Nullable<Timestamp>)]
    rate_date: Option<NaiveDateTime>,
    #[diesel(sql_type = Nullable<Text>)]
    original_decimal: Option<String>,
    #[diesel(sql_type = Nullable<BigInt>)]
    coefficient: Option<i64>,
    #[diesel(sql_type = Nullable<Integer>)]
    scale: Option<i32>,
    #[diesel(sql_type = Integer)]
    formula_version: i32,
}

pub(crate) struct ExportRateFields {
    pub revision: TransactionExchangeRateRevision,
    pub formula_version: u32,
    pub complete: bool,
}

pub(crate) fn load_export_rate_fields(
    conn: &mut SqliteConnection,
    rows: &[TransactionRow],
) -> Result<HashMap<String, ExportRateFields>> {
    if rows.is_empty() {
        return Ok(HashMap::new());
    }
    let generation = active_generation(conn)?;
    let ids = rows.iter().map(|row| row.id.clone()).collect::<Vec<_>>();
    let in_list = trusted_id_list(&ids)?;
    let rate_rows = sql_query(format!(
        "SELECT transaction_id, sequence, variant, rate_date, original_decimal, coefficient, scale, formula_version \
         FROM transaction_exchange_rate_revisions \
         WHERE transaction_id IN ({in_list})"
    ))
    .load::<ExportRateRow>(conn)
    .into_storage()?;
    let mut latest: HashMap<String, ExportRateRow> = HashMap::new();
    for row in rate_rows {
        match latest.get(&row.transaction_id) {
            Some(existing) if existing.sequence >= row.sequence => {}
            _ => {
                latest.insert(row.transaction_id.clone(), row);
            }
        }
    }
    let valuations = load_valuations(conn, &generation.id, &ids)?;
    let complete_by_id = valuations
        .into_iter()
        .map(|(id, _, _, complete)| (id, complete))
        .collect::<HashMap<_, _>>();
    let mut fields = HashMap::new();
    for row in rows {
        let stored = latest
            .remove(&row.id)
            .map(|loaded| StoredRateRevision {
                variant: loaded.variant,
                rate_date: loaded.rate_date,
                original_decimal: loaded.original_decimal,
                coefficient: loaded.coefficient,
                scale: loaded.scale,
                formula_version: loaded.formula_version,
            })
            .unwrap_or_else(|| StoredRateRevision {
                variant: "identity".to_string(),
                rate_date: Some(row.transaction_date),
                original_decimal: None,
                coefficient: None,
                scale: None,
                formula_version: i32::try_from(CONVERSION_FORMULA_VERSION).unwrap_or(1),
            });
        let formula_version = stored.formula_version_u32();
        fields.insert(
            row.id.clone(),
            ExportRateFields {
                revision: stored.into_dto(&row.currency, &generation.target_currency),
                formula_version,
                complete: complete_by_id.get(&row.id).copied().unwrap_or(false),
            },
        );
    }
    Ok(fields)
}

fn trusted_id_list(ids: &[String]) -> Result<String> {
    if ids.iter().any(|id| {
        !id.bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    }) {
        return Err(Error::InvalidData(
            "Transaction id contains invalid characters".to_string(),
        ));
    }
    Ok(ids
        .iter()
        .map(|id| format!("'{id}'"))
        .collect::<Vec<_>>()
        .join(", "))
}

type LoadedValuation = (String, Option<i32>, String, bool);

fn load_valuations(
    conn: &mut SqliteConnection,
    generation_id: &str,
    ids: &[String],
) -> Result<Vec<LoadedValuation>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let in_list = trusted_id_list(ids)?;
    sql_query(format!(
        "SELECT transaction_id, converted_amount, converted_currency, complete \
         FROM transaction_valuations \
         WHERE generation_id = ? AND transaction_id IN ({in_list})"
    ))
    .bind::<Text, _>(generation_id)
    .load::<ValuationRow>(conn)
    .into_storage()?
    .into_iter()
    .map(|row| {
        Ok((
            row.transaction_id,
            row.converted_amount.map(wire_minor).transpose()?,
            row.converted_currency,
            row.complete,
        ))
    })
    .collect()
}

fn wire_i32(value: u32, label: &str) -> Result<i32> {
    i32::try_from(value).map_err(|_| Error::InvalidData(format!("{label} exceeds stored range")))
}

fn wire_minor(amount: i64) -> Result<i32> {
    if amount > WIRE_MAX_MINOR_UNITS {
        return Err(Error::InvalidData(
            "Persisted money exceeds the JavaScript-safe wire maximum".to_string(),
        ));
    }
    i32::try_from(amount).map_err(|_| {
        Error::InvalidData("Persisted money exceeds the JavaScript-safe wire maximum".to_string())
    })
}

pub(crate) fn require_supported_currency(code: &str) -> Result<()> {
    match money::CurrencyCode::parse(code) {
        Ok(_) => Ok(()),
        Err(Error::InvalidData(message)) if message.starts_with("Unsupported currency code") => {
            Err(Error::UnsupportedCurrency(code.trim().to_ascii_uppercase()))
        }
        Err(other) => Err(other),
    }
}

pub(crate) fn require_selectable_currency(conn: &mut SqliteConnection, code: &str) -> Result<()> {
    require_supported_currency(code)?;
    crate::currency::require_enabled_currency(conn, code)
}
