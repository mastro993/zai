use super::{CanonicalRate, ConversionRate, CurrencyCode, Money, convert};

fn rate(raw: &str) -> CanonicalRate {
    CanonicalRate::parse(raw).expect("fixture rate")
}

fn money(minor_units: i64, code: &str) -> Money {
    Money::from_minor_units(minor_units, code).expect("fixture money")
}

fn code(raw: &str) -> CurrencyCode {
    CurrencyCode::parse(raw).expect("fixture currency")
}

#[test]
fn canonical_rate_rejects_zero_and_non_decimal_input() {
    assert!(CanonicalRate::parse("0").is_err());
    assert!(CanonicalRate::parse("0.00").is_err());
    assert!(CanonicalRate::parse("-1.2").is_err());
    assert!(CanonicalRate::parse("1.2.3").is_err());
    assert!(CanonicalRate::parse("1e2").is_err());
}

#[test]
fn canonical_rate_inverse_of_one_is_one() {
    assert_eq!(
        CanonicalRate::one()
            .inverse()
            .expect("inverse")
            .original_decimal(),
        "1"
    );
}

#[test]
fn canonical_rate_inverse_of_two_is_one_half() {
    assert_eq!(
        rate("2").inverse().expect("inverse").original_decimal(),
        "0.5"
    );
}

#[test]
fn yen_to_euro_quote_keeps_sub_cent_digits() {
    let quoted = CanonicalRate::one()
        .checked_div(&rate("186.5"))
        .expect("quote");

    assert_ne!(quoted.original_decimal(), "0.01");
    assert!(
        quoted.original_decimal().starts_with("0.00536193"),
        "{}",
        quoted.original_decimal()
    );
}

#[test]
fn yen_to_euro_quote_converts_1000_yen_to_536_cents() {
    let quoted = CanonicalRate::one()
        .checked_div(&rate("186.5"))
        .expect("quote");
    let conversion = convert(
        money(1000, "JPY"),
        code("EUR"),
        &ConversionRate::Manual(quoted),
    )
    .expect("convert");

    assert_eq!(conversion.converted.expect("amount").minor_units(), 536);
}

#[test]
fn idr_to_euro_quote_does_not_collapse_to_zero() {
    let quoted = CanonicalRate::one()
        .checked_div(&rate("17000"))
        .expect("quote");

    assert_ne!(quoted.original_decimal(), "0");
    assert_ne!(quoted.original_decimal(), "0.00");
    assert!(
        quoted.original_decimal().starts_with("0.00005882"),
        "{}",
        quoted.original_decimal()
    );
}

#[test]
fn usd_to_jpy_cross_quote_divides_legs() {
    let quoted = rate("160.15").checked_div(&rate("1.0852")).expect("quote");

    assert!(
        quoted.original_decimal().starts_with("147.576"),
        "{}",
        quoted.original_decimal()
    );
}

#[test]
fn inverse_of_three_keeps_eighteen_significant_digits() {
    assert_eq!(
        rate("3").inverse().expect("inverse").original_decimal(),
        "0.333333333333333333"
    );
}
