use crate::Error;
use std::fmt;

/// Validated alphabetic ISO 4217 code from the current currency manifest.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct CurrencyCode(&'static str);

impl CurrencyCode {
    pub fn parse(raw: &str) -> crate::Result<Self> {
        let normalized = normalize_currency_code(raw)?;
        super::CURRENT_MANIFEST
            .record_for_normalized(&normalized)
            .map(|record| record.code)
            .ok_or_else(|| {
                Error::InvalidData(format!(
                    "Unsupported currency code: {}",
                    std::str::from_utf8(&normalized).unwrap_or(raw)
                ))
            })
    }

    pub const fn as_str(self) -> &'static str {
        self.0
    }

    pub fn minor_unit_digits(self) -> u8 {
        super::CURRENT_MANIFEST.record(self).minor_unit_digits
    }
}

impl fmt::Display for CurrencyCode {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.0)
    }
}

pub(crate) fn normalize_currency_code(raw: &str) -> crate::Result<[u8; 3]> {
    let trimmed = raw.trim().as_bytes();
    if trimmed.len() != 3 || !trimmed.iter().all(u8::is_ascii_alphabetic) {
        return Err(Error::InvalidData(
            "Currency code must be three ASCII letters".to_string(),
        ));
    }
    Ok([
        trimmed[0].to_ascii_uppercase(),
        trimmed[1].to_ascii_uppercase(),
        trimmed[2].to_ascii_uppercase(),
    ])
}

pub(crate) const fn from_manifest_code(code: &'static str) -> CurrencyCode {
    CurrencyCode(code)
}
