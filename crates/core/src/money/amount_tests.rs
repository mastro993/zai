use super::{CurrencyCode, Money, WIRE_MAX_MINOR_UNITS, format_minor_units};
use crate::Error;

#[test]
fn money_from_minor_units_keeps_exact_non_negative_count() {
    let money = Money::from_minor_units(1234, "EUR").expect("valid money");

    assert_eq!(money.minor_units(), 1234);
}

#[test]
fn money_from_minor_units_accepts_zero() {
    let money = Money::from_minor_units(0, "JPY").expect("zero is valid");

    assert_eq!(money.minor_units(), 0);
}

#[test]
fn money_new_rejects_negative_minor_units() {
    let currency = CurrencyCode::parse("EUR").expect("EUR is supported");

    let error = Money::new(-1, currency).expect_err("negative money");

    assert!(matches!(error, Error::InvalidData(message) if message.contains("negative")));
}

#[test]
fn money_from_minor_units_rejects_unknown_currency() {
    let error = Money::from_minor_units(1, "XXX").expect_err("test code is excluded");

    assert!(matches!(error, Error::InvalidData(message) if message.contains("XXX")));
}

#[test]
fn money_from_minor_units_rejects_malformed_currency() {
    let error = Money::from_minor_units(1, "eu").expect_err("too short");

    assert!(matches!(error, Error::InvalidData(message) if message.contains("three ASCII")));
}

#[test]
fn money_parses_currency_codes_case_insensitively() {
    let money = Money::from_minor_units(10, "eur").expect("lowercase EUR");

    assert_eq!(money.currency().as_str(), "EUR");
}

#[test]
fn money_minor_unit_digits_come_from_the_manifest() {
    let yen = Money::from_minor_units(1976, "JPY").expect("yen");
    let dinar = Money::from_minor_units(5059, "BHD").expect("dinar");

    assert_eq!(yen.minor_unit_digits(), 0);
    assert_eq!(dinar.minor_unit_digits(), 3);
}

#[test]
fn money_from_authored_accepts_the_javascript_safe_maximum() {
    let money = Money::from_authored(i32::MAX, "USD").expect("wire max");

    assert_eq!(money.minor_units(), WIRE_MAX_MINOR_UNITS);
}

#[test]
fn money_persists_values_above_the_wire_maximum() {
    let money = Money::from_minor_units(WIRE_MAX_MINOR_UNITS + 1, "EUR").expect("persist i64");

    assert_eq!(money.minor_units(), WIRE_MAX_MINOR_UNITS + 1);
}

#[test]
fn format_minor_units_uses_iso_digits() {
    assert_eq!(format_minor_units(350, 2), "3.50");
    assert_eq!(format_minor_units(1976, 0), "1976");
    assert_eq!(format_minor_units(5059, 3), "5.059");
    assert_eq!(
        Money::from_minor_units(350, "EUR")
            .expect("eur")
            .format_decimal(),
        "3.50"
    );
}

#[test]
fn money_try_to_wire_minor_units_rejects_values_above_i32_max() {
    let money = Money::from_minor_units(WIRE_MAX_MINOR_UNITS + 1, "EUR").expect("persist i64");

    let error = money.try_to_wire_minor_units().expect_err("over wire cap");

    assert!(matches!(error, Error::InvalidData(message) if message.contains("wire maximum")));
}

#[test]
fn money_try_to_wire_minor_units_returns_authored_i32() {
    let money = Money::from_authored(12_345, "EUR").expect("authored");

    assert_eq!(money.try_to_wire_minor_units().expect("in range"), 12_345);
}
