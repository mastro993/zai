use super::{CURRENT_MANIFEST, CurrencyCode};
use crate::Error;

/// JavaScript-safe authored and wire maximum, in ISO minor units.
pub const WIRE_MAX_MINOR_UNITS: i64 = i32::MAX as i64;

/// Exact non-negative count of ISO minor units plus a validated currency code.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Money {
    minor_units: i64,
    currency: CurrencyCode,
}

impl Money {
    pub fn new(minor_units: i64, currency: CurrencyCode) -> crate::Result<Self> {
        if minor_units < 0 {
            return Err(Error::InvalidData(
                "Money amount cannot be negative".to_string(),
            ));
        }
        Ok(Self {
            minor_units,
            currency,
        })
    }

    pub fn from_minor_units(minor_units: i64, code: &str) -> crate::Result<Self> {
        Self::new(minor_units, CurrencyCode::parse(code)?)
    }

    pub fn from_authored(minor_units: i32, code: &str) -> crate::Result<Self> {
        if minor_units < 0 {
            return Err(Error::InvalidData(
                "Money amount cannot be negative".to_string(),
            ));
        }
        Self::from_minor_units(i64::from(minor_units), code)
    }

    pub fn try_to_wire_minor_units(self) -> crate::Result<i32> {
        i32::try_from(self.minor_units).map_err(|_| {
            Error::InvalidData(
                "Authored money exceeds the JavaScript-safe wire maximum".to_string(),
            )
        })
    }

    pub const fn minor_units(self) -> i64 {
        self.minor_units
    }

    pub const fn currency(self) -> CurrencyCode {
        self.currency
    }

    pub fn minor_unit_digits(self) -> u8 {
        CURRENT_MANIFEST.record(self.currency).minor_unit_digits
    }

    pub fn format_decimal(self) -> String {
        format_minor_units(self.minor_units, self.minor_unit_digits())
    }
}

/// Formats ISO minor units using the currency's fraction-digit count.
pub fn format_minor_units(minor_units: i64, digits: u8) -> String {
    if digits == 0 {
        return minor_units.to_string();
    }
    let factor = 10_i64.pow(u32::from(digits));
    let whole = minor_units / factor;
    let fraction = minor_units.rem_euclid(factor);
    format!("{whole}.{:0width$}", fraction, width = usize::from(digits))
}
