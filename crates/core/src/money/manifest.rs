use super::currency::{CurrencyCode, from_manifest_code, normalize_currency_code};
use super::generated::{CANDIDATE_COUNT, RAW_CURRENCIES, RawCurrency};
use crate::Error;
use chrono::NaiveDate;
use std::sync::OnceLock;

/// ISO/SIX currency definition pinned to one manifest version.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CurrencyRecord {
    pub code: CurrencyCode,
    pub numeric_code: u16,
    pub name: &'static str,
    pub minor_unit_digits: u8,
    pub valid_from: NaiveDate,
    pub valid_to: Option<NaiveDate>,
}

impl CurrencyRecord {
    pub fn is_valid_on(self, date: NaiveDate) -> bool {
        date >= self.valid_from && self.valid_to.is_none_or(|end| date <= end)
    }
}

/// Versioned ISO/SIX + CLDR candidate catalog. Immutable after generation.
#[derive(Debug)]
pub struct CurrencyManifest;

pub static CURRENT_MANIFEST: CurrencyManifest = CurrencyManifest;

static BUILT_RECORDS: OnceLock<Vec<CurrencyRecord>> = OnceLock::new();

impl CurrencyManifest {
    fn records(&self) -> &'static [CurrencyRecord] {
        BUILT_RECORDS.get_or_init(build_records).as_slice()
    }

    pub fn get(&self, code: &str) -> Option<&CurrencyRecord> {
        let normalized = normalize_currency_code(code).ok()?;
        self.record_for_normalized(&normalized)
    }

    pub fn require(&self, code: &str) -> crate::Result<&CurrencyRecord> {
        let normalized = normalize_currency_code(code)?;
        self.record_for_normalized(&normalized).ok_or_else(|| {
            Error::InvalidData(format!(
                "Unsupported currency code: {}",
                std::str::from_utf8(&normalized).unwrap_or(code)
            ))
        })
    }

    pub fn record(&self, code: CurrencyCode) -> &CurrencyRecord {
        self.record_for_normalized(code.as_str().as_bytes())
            .expect("validated currency code is present in the current manifest")
    }

    pub fn currencies(&self) -> impl Iterator<Item = &CurrencyRecord> {
        self.records().iter()
    }

    pub(crate) fn record_for_normalized(&self, code: &[u8]) -> Option<&CurrencyRecord> {
        self.records()
            .binary_search_by_key(&code, |record| record.code.as_str().as_bytes())
            .ok()
            .map(|index| &self.records()[index])
    }
}

fn build_records() -> Vec<CurrencyRecord> {
    assert_eq!(RAW_CURRENCIES.len(), CANDIDATE_COUNT);
    RAW_CURRENCIES.iter().map(build_record).collect()
}

fn build_record(raw: &RawCurrency) -> CurrencyRecord {
    let (year, month, day) = raw.valid_from_ymd;
    let valid_from = NaiveDate::from_ymd_opt(year, month, day)
        .expect("generated currency valid_from must be a real calendar date");
    CurrencyRecord {
        code: from_manifest_code(raw.code),
        numeric_code: raw.numeric_code,
        name: raw.name,
        minor_unit_digits: raw.minor_unit_digits,
        valid_from,
        valid_to: None,
    }
}
