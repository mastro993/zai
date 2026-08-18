use super::restate_authored_allowance;
use crate::money::{CanonicalRate, ConversionRate, CurrencyCode, Money};
use chrono::NaiveDate;

fn eur(minor: i64) -> Money {
    Money::from_minor_units(minor, "EUR").unwrap()
}

fn usd() -> CurrencyCode {
    CurrencyCode::parse("USD").unwrap()
}

#[test]
fn same_currency_identity_restates_complete() {
    let restated = restate_authored_allowance(
        eur(10_000),
        CurrencyCode::parse("EUR").unwrap(),
        &ConversionRate::Identity,
    )
    .unwrap();
    assert!(restated.complete);
    assert_eq!(restated.converted.unwrap().minor_units(), 10_000);
}

#[test]
fn pending_period_start_rate_is_incomplete() {
    let restated = restate_authored_allowance(
        eur(10_000),
        usd(),
        &ConversionRate::Pending {
            rate_date: NaiveDate::from_ymd_opt(2026, 8, 1).unwrap(),
        },
    )
    .unwrap();
    assert!(!restated.complete);
    assert!(restated.converted.is_none());
}

#[test]
fn manual_period_start_rate_restates_once() {
    let restated = restate_authored_allowance(
        eur(10_000),
        usd(),
        &ConversionRate::Manual(CanonicalRate::parse("1.10").unwrap()),
    )
    .unwrap();
    assert!(restated.complete);
    assert_eq!(restated.converted.unwrap().currency(), usd());
    assert_eq!(restated.converted.unwrap().minor_units(), 11_000);
}
