use chrono::NaiveDateTime;

use crate::money::{CURRENT_MANIFEST, format_minor_units};
use crate::{Error, Result};

use super::models::{RateOrigin, RateVariant, TransactionExchangeRateRevision};

pub const TRANSACTION_EXPORT_VERSION: u32 = 1;
pub const ZAI_EXPORT_VERSION_HEADER: &str = "zai_export_version";
pub const LEGACY_EXPORT_HEADERS: &str =
    "date,amount,type,description,notes,parent_category,category";
pub const UPGRADE_EXPORT_MESSAGE: &str =
    "This Zai export requires a newer app version. Upgrade Zai to import this file.";

const HEADERS: &str = "zai_export_version,date,amount_minor,amount,currency,type,description,notes,parent_category,category,rate_variant,rate_state,rate_date,source_observation_date,source_currency,reference_currency,coefficient,scale,original_decimal,formula_version,origin";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CsvCategoryColumns {
    pub parent_category: String,
    pub category: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CsvTransactionRow<'a> {
    pub transaction_date: NaiveDateTime,
    pub amount_minor: i32,
    pub currency: &'a str,
    pub transaction_type: &'a str,
    pub description: Option<&'a str>,
    pub notes: Option<&'a str>,
    pub category: CsvCategoryColumns,
    pub exchange_rate: TransactionExchangeRateRevision,
    pub formula_version: u32,
    pub complete: bool,
}

pub fn is_zai_transaction_export(headers: &[String]) -> bool {
    headers.iter().any(|header| {
        header
            .trim()
            .eq_ignore_ascii_case(ZAI_EXPORT_VERSION_HEADER)
    })
}

pub fn is_legacy_seven_column_export(headers: &[String]) -> bool {
    let normalized: Vec<String> = headers
        .iter()
        .map(|header| header.trim().to_ascii_lowercase())
        .collect();
    normalized.join(",") == LEGACY_EXPORT_HEADERS
}

pub fn parse_export_version(value: &str) -> Result<u32> {
    let trimmed = value.trim();
    let version = trimmed.parse::<u32>().map_err(|_| {
        Error::InvalidData("Zai export version must be a positive integer".to_string())
    })?;
    if version == 0 {
        return Err(Error::InvalidData(
            "Zai export version must be a positive integer".to_string(),
        ));
    }
    if version > TRANSACTION_EXPORT_VERSION {
        return Err(Error::InvalidData(UPGRADE_EXPORT_MESSAGE.to_string()));
    }
    Ok(version)
}

fn format_amount_from_minor(minor_units: i32, currency: &str) -> String {
    let digits = CURRENT_MANIFEST
        .get(&currency.to_ascii_uppercase())
        .map(|record| record.minor_unit_digits)
        .unwrap_or(2);
    format_minor_units(i64::from(minor_units), digits)
}

fn format_date(datetime: NaiveDateTime) -> String {
    datetime.format("%Y-%m-%dT%H:%M:%S").to_string()
}

fn rate_variant_wire(variant: RateVariant) -> &'static str {
    match variant {
        RateVariant::Identity => "identity",
        RateVariant::Automatic => "automatic",
        RateVariant::Manual => "manual",
        RateVariant::Pending => "pending",
    }
}

fn rate_origin_wire(origin: RateOrigin) -> &'static str {
    match origin {
        RateOrigin::Supplied => "supplied",
        RateOrigin::Manual => "manual",
    }
}

fn rate_state(row: &CsvTransactionRow<'_>) -> &'static str {
    if matches!(row.exchange_rate.variant, RateVariant::Pending) || !row.complete {
        "pending"
    } else {
        "complete"
    }
}

pub fn escape_csv_value(value: &str) -> String {
    let needs_formula_protection = value.chars().next().is_some_and(|character| {
        matches!(
            character,
            '=' | '+' | '-' | '@' | '\t' | '\r' | '\n' | '＝' | '＋' | '－' | '＠'
        )
    });
    let protected = if needs_formula_protection {
        format!("\t{value}")
    } else {
        value.to_string()
    };
    let escaped = protected.replace('"', "\"\"");
    if needs_formula_protection || escaped.contains(['"', ',', '\r', '\n']) {
        format!("\"{escaped}\"")
    } else {
        escaped
    }
}

fn optional_number<T: ToString>(value: Option<T>) -> String {
    value.map(|item| item.to_string()).unwrap_or_default()
}

fn row_to_csv(row: &CsvTransactionRow<'_>) -> String {
    let rate = &row.exchange_rate;
    [
        TRANSACTION_EXPORT_VERSION.to_string(),
        format_date(row.transaction_date),
        row.amount_minor.to_string(),
        format_amount_from_minor(row.amount_minor, row.currency),
        row.currency.to_string(),
        row.transaction_type.to_string(),
        row.description.unwrap_or("").to_string(),
        row.notes.unwrap_or("").to_string(),
        row.category.parent_category.clone(),
        row.category.category.clone(),
        rate_variant_wire(rate.variant).to_string(),
        rate_state(row).to_string(),
        rate.rate_date.clone(),
        rate.source_observation_date.clone().unwrap_or_default(),
        rate.source_currency.clone(),
        rate.reference_currency.clone(),
        optional_number(rate.coefficient),
        optional_number(rate.scale),
        rate.original_decimal.clone().unwrap_or_default(),
        row.formula_version.to_string(),
        rate_origin_wire(rate.origin).to_string(),
    ]
    .into_iter()
    .map(|field| escape_csv_value(&field))
    .collect::<Vec<_>>()
    .join(",")
}

pub fn format_transactions_csv(rows: &[CsvTransactionRow<'_>]) -> String {
    let mut lines = Vec::with_capacity(rows.len() + 1);
    lines.push(HEADERS.to_string());
    lines.extend(rows.iter().map(row_to_csv));
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::transactions::models::TransactionExchangeRateRevision;
    use crate::money::CONVERSION_FORMULA_VERSION;
    use chrono::NaiveDateTime;

    fn parse_datetime(value: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S").expect("valid datetime")
    }

    fn identity_rate(currency: &str, date: &str) -> TransactionExchangeRateRevision {
        TransactionExchangeRateRevision::identity(currency, parse_datetime(date))
    }

    #[test]
    fn formats_full_fidelity_source_fields() {
        let rows = [
            CsvTransactionRow {
                transaction_date: parse_datetime("2026-01-15T08:30:00"),
                amount_minor: 350,
                currency: "EUR",
                transaction_type: "expense",
                description: Some("Coffee, \"special\""),
                notes: Some("Morning\nrun"),
                category: CsvCategoryColumns {
                    parent_category: "Food".to_string(),
                    category: "Groceries".to_string(),
                },
                exchange_rate: identity_rate("EUR", "2026-01-15T08:30:00"),
                formula_version: CONVERSION_FORMULA_VERSION,
                complete: true,
            },
            CsvTransactionRow {
                transaction_date: parse_datetime("2026-01-01T00:00:00"),
                amount_minor: 250_000,
                currency: "EUR",
                transaction_type: "income",
                description: Some("Salary"),
                notes: None,
                category: CsvCategoryColumns {
                    parent_category: String::new(),
                    category: String::new(),
                },
                exchange_rate: identity_rate("EUR", "2026-01-01T00:00:00"),
                formula_version: CONVERSION_FORMULA_VERSION,
                complete: true,
            },
        ];

        let csv = format_transactions_csv(&rows);

        assert_eq!(
            csv,
            [
                HEADERS,
                "1,2026-01-15T08:30:00,350,3.50,EUR,expense,\"Coffee, \"\"special\"\"\",\"Morning\nrun\",Food,Groceries,identity,complete,2026-01-15,,EUR,EUR,1,0,1,1,supplied",
                "1,2026-01-01T00:00:00,250000,2500.00,EUR,income,Salary,,,,identity,complete,2026-01-01,,EUR,EUR,1,0,1,1,supplied",
            ]
            .join("\n")
        );
        assert!(!csv.contains("converted"));
    }

    #[test]
    fn formats_zero_decimal_yen_without_forcing_two_digits() {
        let rows = [CsvTransactionRow {
            transaction_date: parse_datetime("2026-03-01T00:00:00"),
            amount_minor: 1976,
            currency: "JPY",
            transaction_type: "expense",
            description: Some("Rail"),
            notes: None,
            category: CsvCategoryColumns {
                parent_category: String::new(),
                category: String::new(),
            },
            exchange_rate: identity_rate("JPY", "2026-03-01T00:00:00"),
            formula_version: CONVERSION_FORMULA_VERSION,
            complete: true,
        }];

        let csv = format_transactions_csv(&rows);
        assert!(csv.contains(",1976,1976,JPY,"));
        assert!(!csv.contains("19.76"));
    }

    #[test]
    fn neutralizes_spreadsheet_formula_prefixes() {
        for prefix in ["=", "+", "-", "@", "\t", "\r", "\n", "＝", "＋", "－", "＠"] {
            let value = format!("{prefix}1+1");
            assert_eq!(escape_csv_value(&value), format!("\"\t{value}\""));
        }
    }

    #[test]
    fn rejects_newer_unknown_export_versions_with_upgrade_message() {
        let error = parse_export_version("2").expect_err("newer version");
        assert!(matches!(error, Error::InvalidData(message) if message == UPGRADE_EXPORT_MESSAGE));
    }

    #[test]
    fn detects_legacy_seven_column_exports() {
        let headers = LEGACY_EXPORT_HEADERS
            .split(',')
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>();
        assert!(is_legacy_seven_column_export(&headers));
        assert!(!is_zai_transaction_export(&headers));
    }
}
