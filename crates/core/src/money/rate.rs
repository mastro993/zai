use super::CurrencyCode;
use crate::Error;
use chrono::NaiveDate;
use std::fmt;

/// Snapshot formula used by checked conversion. Stored with later revisions.
pub const CONVERSION_FORMULA_VERSION: u32 = 1;

/// Documented rounding rule applied once at the target ISO minor unit.
pub const ROUNDING_RULE: &str = "halfEven";

/// Provider or user decimal retained as original text plus a positive rational.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CanonicalRate {
    original_decimal: String,
    coefficient: i64,
    scale: u32,
}

impl CanonicalRate {
    pub fn parse(original_decimal: &str) -> crate::Result<Self> {
        let trimmed = original_decimal.trim();
        let (coefficient, scale) = parse_positive_decimal(trimmed)?;
        Ok(Self {
            original_decimal: trimmed.to_string(),
            coefficient,
            scale,
        })
    }

    pub fn one() -> Self {
        Self {
            original_decimal: "1".to_string(),
            coefficient: 1,
            scale: 0,
        }
    }

    pub fn original_decimal(&self) -> &str {
        &self.original_decimal
    }

    pub const fn coefficient(&self) -> i64 {
        self.coefficient
    }

    pub const fn scale(&self) -> u32 {
        self.scale
    }

    /// Reciprocal used when a mapped external rate is default→transaction.
    pub fn inverse(&self) -> crate::Result<Self> {
        Self::one().checked_div(self)
    }

    /// `self / divisor` as a positive decimal, up to 18 significant digits.
    ///
    /// Quote of source→target is `target_leg.checked_div(source_leg)`.
    /// Never round a rate to ISO minor units of either currency.
    pub fn checked_div(&self, divisor: &Self) -> crate::Result<Self> {
        let numer = i128::from(self.coefficient)
            .checked_mul(pow10_i128(divisor.scale)?)
            .ok_or_else(cannot_divide)?;
        let denom = i128::from(divisor.coefficient)
            .checked_mul(pow10_i128(self.scale)?)
            .ok_or_else(cannot_divide)?;
        from_ratio(numer, denom)
    }
}

impl fmt::Display for CanonicalRate {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.original_decimal)
    }
}

/// One provider observation: units of `currency` for one unit of the provider quote unit.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RateObservation {
    pub currency: CurrencyCode,
    pub value_date: NaiveDate,
    pub rate: CanonicalRate,
}

/// Automatic conversion keeps both source legs from one immutable rate set.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AutomaticRate {
    pub rate_set_id: String,
    pub source: RateObservation,
    pub reference: RateObservation,
}

/// Exactly one transaction-exchange-rate variant.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConversionRate {
    Identity,
    Automatic(AutomaticRate),
    Manual(CanonicalRate),
    Pending { rate_date: NaiveDate },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RateVariantKind {
    Identity,
    Automatic,
    Manual,
    Pending,
}

impl ConversionRate {
    pub const fn kind(&self) -> RateVariantKind {
        match self {
            Self::Identity => RateVariantKind::Identity,
            Self::Automatic(_) => RateVariantKind::Automatic,
            Self::Manual(_) => RateVariantKind::Manual,
            Self::Pending { .. } => RateVariantKind::Pending,
        }
    }
}

fn parse_positive_decimal(raw: &str) -> crate::Result<(i64, u32)> {
    let digits = raw.strip_prefix('+').unwrap_or(raw);
    if digits.is_empty() || digits.starts_with('-') || digits == "." {
        return invalid_rate();
    }
    let (whole, fraction) = match digits.split_once('.') {
        None => (digits, ""),
        Some((whole, fraction)) => (whole, fraction),
    };
    if (whole.is_empty() && fraction.is_empty())
        || !whole.bytes().all(|byte| byte.is_ascii_digit())
        || !fraction.bytes().all(|byte| byte.is_ascii_digit())
    {
        return invalid_rate();
    }
    if whole.len() > 1 && whole.starts_with('0') {
        return invalid_rate();
    }
    let combined = format!("{whole}{fraction}");
    if combined.bytes().all(|byte| byte == b'0') {
        return invalid_rate();
    }
    let coefficient = combined
        .parse::<i64>()
        .map_err(|_| Error::InvalidData("Exchange rate coefficient exceeds i64".to_string()))?;
    if coefficient <= 0 {
        return invalid_rate();
    }
    let scale = u32::try_from(fraction.len())
        .map_err(|_| Error::InvalidData("Exchange rate scale is too large".to_string()))?;
    Ok((coefficient, scale))
}

fn invalid_rate() -> crate::Result<(i64, u32)> {
    Err(Error::InvalidData(
        "Exchange rate must be a positive finite decimal".to_string(),
    ))
}

/// Coefficient fits i64 (~18 digits). Extra digits would overflow parse.
const RATE_SIGNIFICANT_DIGITS: usize = 18;

fn from_ratio(numer: i128, denom: i128) -> crate::Result<CanonicalRate> {
    if numer <= 0 || denom <= 0 {
        return Err(cannot_divide());
    }
    let mut whole = numer / denom;
    let mut remainder = numer % denom;
    if remainder == 0 {
        return CanonicalRate::parse(&whole.to_string());
    }

    let mut fraction = Vec::<u8>::new();
    let mut significant = if whole == 0 {
        0
    } else {
        whole.to_string().len()
    };

    while remainder != 0 && significant < RATE_SIGNIFICANT_DIGITS {
        remainder = remainder.checked_mul(10).ok_or_else(cannot_divide)?;
        let digit = remainder / denom;
        remainder %= denom;
        let digit = u8::try_from(digit).map_err(|_| cannot_divide())?;
        fraction.push(digit);
        if whole != 0 || fraction.iter().any(|&value| value != 0) {
            significant += 1;
        }
    }

    if remainder != 0 {
        remainder = remainder.checked_mul(10).ok_or_else(cannot_divide)?;
        let next = remainder / denom;
        remainder %= denom;
        let last_is_odd = match fraction.last() {
            Some(digit) => digit % 2 == 1,
            None => whole % 2 == 1,
        };
        let round_up = next > 5 || (next == 5 && (remainder != 0 || last_is_odd));
        if round_up {
            round_up_fraction(&mut whole, fraction.as_mut_slice());
        }
    }

    let mut raw = whole.to_string();
    if !fraction.is_empty() {
        raw.push('.');
        for digit in fraction {
            raw.push(char::from(b'0' + digit));
        }
    }
    let trimmed = raw.trim_end_matches('0').trim_end_matches('.');
    if trimmed.is_empty() || trimmed == "0" {
        return Err(cannot_divide());
    }
    CanonicalRate::parse(trimmed)
}

fn round_up_fraction(whole: &mut i128, fraction: &mut [u8]) {
    for digit in fraction.iter_mut().rev() {
        if *digit < 9 {
            *digit += 1;
            return;
        }
        *digit = 0;
    }
    *whole += 1;
}

fn pow10_i128(scale: u32) -> crate::Result<i128> {
    10_i128.checked_pow(scale).ok_or_else(cannot_divide)
}

fn cannot_divide() -> Error {
    Error::InvalidData("Cannot invert exchange rate".to_string())
}
