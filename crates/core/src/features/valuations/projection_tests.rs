use super::{ProjectionQuote, convert_projected};
use crate::money::{CanonicalRate, ConversionRate, CurrencyCode, Money};
use chrono::NaiveDate;

fn usd(minor: i64) -> Money {
    Money::from_minor_units(minor, "USD").unwrap()
}

fn eur() -> CurrencyCode {
    CurrencyCode::parse("EUR").unwrap()
}

#[test]
fn missing_projection_pair_omits_and_is_incomplete() {
    let converted = convert_projected(usd(2_500), eur(), None).unwrap();
    assert!(converted.omitted);
    assert!(!converted.complete);
    assert!(converted.converted.is_none());
    assert!(!converted.stale);
}

#[test]
fn stale_last_known_good_converts_with_stale_status() {
    let quote = ProjectionQuote {
        rate: ConversionRate::Manual(CanonicalRate::parse("0.90").unwrap()),
        stale: true,
    };
    let converted = convert_projected(usd(10_000), eur(), Some(&quote)).unwrap();
    assert!(converted.complete);
    assert!(!converted.omitted);
    assert!(converted.stale);
    assert_eq!(converted.converted.unwrap().minor_units(), 9_000);
}

#[test]
fn pending_projection_quote_omits_occurrence() {
    let quote = ProjectionQuote {
        rate: ConversionRate::Pending {
            rate_date: NaiveDate::from_ymd_opt(2026, 8, 18).unwrap(),
        },
        stale: false,
    };
    let converted = convert_projected(usd(10_000), eur(), Some(&quote)).unwrap();
    assert!(converted.omitted);
    assert!(!converted.complete);
}
