use super::{
    AutomaticRate, CanonicalRate, ConversionRate, CurrencyCode, Money, ROUNDING_RULE,
    RateObservation, RateVariantKind, convert,
};
use crate::Error;
use chrono::NaiveDate;

fn date(year: i32, month: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(year, month, day).expect("fixture date")
}

fn money(minor_units: i64, code: &str) -> Money {
    Money::from_minor_units(minor_units, code).expect("fixture money")
}

fn code(raw: &str) -> CurrencyCode {
    CurrencyCode::parse(raw).expect("fixture currency")
}

fn rate(raw: &str) -> CanonicalRate {
    CanonicalRate::parse(raw).expect("fixture rate")
}

fn observation(currency: &str, value: &str) -> RateObservation {
    RateObservation {
        currency: code(currency),
        value_date: date(2026, 3, 13),
        rate: rate(value),
    }
}

fn automatic(
    source_currency: &str,
    source_rate: &str,
    target_currency: &str,
    target_rate: &str,
) -> ConversionRate {
    ConversionRate::Automatic(AutomaticRate {
        rate_set_id: "ecb:2026-03-13:rev-1".to_string(),
        source: observation(source_currency, source_rate),
        reference: RateObservation {
            currency: code(target_currency),
            value_date: date(2026, 3, 13),
            rate: rate(target_rate),
        },
    })
}

#[test]
fn convert_identity_keeps_the_original_minor_units() {
    let source = money(1234, "EUR");

    let conversion = convert(source, code("EUR"), &ConversionRate::Identity).unwrap();

    assert_eq!(conversion.converted, Some(source));
    assert!(conversion.complete);
    assert_eq!(conversion.variant, RateVariantKind::Identity);
}

#[test]
fn convert_identity_rejects_a_cross_currency_pair() {
    let error = convert(money(1234, "EUR"), code("USD"), &ConversionRate::Identity)
        .expect_err("identity is same-currency only");

    assert!(matches!(error, Error::InvalidData(message) if message.contains("identity")));
}

#[test]
fn convert_pending_is_incomplete_and_has_no_converted_amount() {
    let conversion = convert(
        money(1234, "USD"),
        code("EUR"),
        &ConversionRate::Pending {
            rate_date: date(2026, 3, 13),
        },
    )
    .unwrap();

    assert_eq!(conversion.converted, None);
    assert!(!conversion.complete);
    assert_eq!(conversion.variant, RateVariantKind::Pending);
}

#[test]
fn convert_pending_rejects_same_currency() {
    let error = convert(
        money(1, "EUR"),
        code("EUR"),
        &ConversionRate::Pending {
            rate_date: date(2026, 3, 13),
        },
    )
    .expect_err("same currency is identity");

    assert!(matches!(error, Error::InvalidData(message) if message.contains("identity")));
}

#[test]
fn convert_automatic_uses_both_legs_and_rounds_half_even_once() {
    // 12.34 EUR * 1.0852 USD/EUR = 13.391368 USD → 1339 cents.
    let conversion = convert(
        money(1234, "EUR"),
        code("USD"),
        &automatic("EUR", "1", "USD", "1.0852"),
    )
    .unwrap();

    assert_eq!(conversion.converted.unwrap().minor_units(), 1339);
    assert_eq!(conversion.variant, RateVariantKind::Automatic);
    assert!(conversion.complete);
}

#[test]
fn convert_automatic_uses_iso_digits_for_zero_decimal_yen() {
    // 12.34 EUR * 160.15 JPY/EUR = 1976.251 → 1976 JPY.
    let conversion = convert(
        money(1234, "EUR"),
        code("JPY"),
        &automatic("EUR", "1", "JPY", "160.15"),
    )
    .unwrap();

    assert_eq!(conversion.converted.unwrap().minor_units(), 1976);
}

#[test]
fn convert_automatic_uses_iso_digits_for_three_decimal_dinar() {
    // 12.34 EUR * 0.410 BHD/EUR = 5.0594 BHD → 5059 fils.
    let conversion = convert(
        money(1234, "EUR"),
        code("BHD"),
        &automatic("EUR", "1", "BHD", "0.410"),
    )
    .unwrap();

    assert_eq!(conversion.converted.unwrap().minor_units(), 5059);
}

#[test]
fn convert_rounds_half_even_down_when_the_kept_digit_is_even() {
    // 1.00 EUR * 1.225 = 1.225 USD → 122.5 cents → 122 (2 is even).
    let conversion = convert(
        money(100, "EUR"),
        code("USD"),
        &automatic("EUR", "1", "USD", "1.225"),
    )
    .unwrap();

    assert_eq!(conversion.converted.unwrap().minor_units(), 122);
}

#[test]
fn convert_rounds_half_even_up_when_the_kept_digit_is_odd() {
    // 1.00 EUR * 1.235 = 1.235 USD → 123.5 cents → 124 (3 is odd).
    let conversion = convert(
        money(100, "EUR"),
        code("USD"),
        &automatic("EUR", "1", "USD", "1.235"),
    )
    .unwrap();

    assert_eq!(conversion.converted.unwrap().minor_units(), 124);
}

#[test]
fn convert_manual_multiplies_by_the_source_to_reference_rate() {
    // 10.00 USD * 0.92 EUR/USD = 9.20 EUR.
    let conversion = convert(
        money(1000, "USD"),
        code("EUR"),
        &ConversionRate::Manual(rate("0.92")),
    )
    .unwrap();

    assert_eq!(conversion.converted.unwrap().minor_units(), 920);
    assert_eq!(conversion.variant, RateVariantKind::Manual);
}

#[test]
fn convert_manual_rejects_same_currency() {
    let error = convert(
        money(1, "EUR"),
        code("EUR"),
        &ConversionRate::Manual(rate("1")),
    )
    .expect_err("same currency is identity");

    assert!(matches!(error, Error::InvalidData(_)));
}

#[test]
fn convert_automatic_rejects_a_mismatched_source_leg() {
    let error = convert(
        money(100, "EUR"),
        code("USD"),
        &automatic("GBP", "1", "USD", "1.1"),
    )
    .expect_err("source leg must match");

    assert!(matches!(error, Error::InvalidData(message) if message.contains("matching")));
}

#[test]
fn convert_automatic_rejects_legs_with_different_value_dates() {
    let rate = ConversionRate::Automatic(AutomaticRate {
        rate_set_id: "ecb:2026-03-13:rev-1".to_string(),
        source: observation("EUR", "1"),
        reference: RateObservation {
            currency: code("USD"),
            value_date: date(2026, 3, 12),
            rate: rate("1.1"),
        },
    });

    let error = convert(money(100, "EUR"), code("USD"), &rate).expect_err("dates must match");

    assert!(matches!(error, Error::InvalidData(message) if message.contains("value date")));
}

#[test]
fn convert_automatic_cross_rate_matches_the_rational_formula() {
    // amount_Y = amount_X * R[Y] / R[X]
    // 12.34 USD * 160.15 / 1.0852 = 1821.093... → 1821 JPY.
    let conversion = convert(
        money(1234, "USD"),
        code("JPY"),
        &automatic("USD", "1.0852", "JPY", "160.15"),
    )
    .unwrap();

    assert_eq!(conversion.converted.unwrap().minor_units(), 1821);
}

#[test]
fn convert_uses_exact_decimal_arithmetic_not_binary_floats() {
    // 1.00 * 0.1 is exactly 0.10. f64 0.1 is a repeating binary.
    let conversion = convert(
        money(100, "EUR"),
        code("USD"),
        &ConversionRate::Manual(rate("0.1")),
    )
    .unwrap();

    assert_eq!(conversion.converted.unwrap().minor_units(), 10);
}

#[test]
fn convert_overflow_fails_closed() {
    let source = Money::from_minor_units(i64::MAX, "JPY").expect("max yen");

    let error = convert(
        source,
        code("BHD"),
        &ConversionRate::Manual(rate("1000000000")),
    )
    .expect_err("overflow");

    assert!(matches!(error, Error::CalculationOverflow(_)));
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
fn convert_automatic_rejects_a_missing_rate_set_identity() {
    let rate = ConversionRate::Automatic(AutomaticRate {
        rate_set_id: "  ".to_string(),
        source: observation("EUR", "1"),
        reference: observation("USD", "1.1"),
    });

    let error = convert(money(100, "EUR"), code("USD"), &rate).expect_err("set required");

    assert!(matches!(error, Error::InvalidData(message) if message.contains("rate set")));
}

#[test]
fn automatic_rate_reciprocal_is_exactly_one() {
    let usd = rate("1.0852");
    let yen = rate("160.15");
    let forward = (
        yen.coefficient() as i128 * 10_i128.pow(usd.scale()),
        usd.coefficient() as i128 * 10_i128.pow(yen.scale()),
    );
    let back = (
        usd.coefficient() as i128 * 10_i128.pow(yen.scale()),
        yen.coefficient() as i128 * 10_i128.pow(usd.scale()),
    );

    assert_eq!(forward.0 * back.0, forward.1 * back.1);
}

#[test]
fn automatic_rate_triangle_matches_the_direct_cross_rate() {
    let usd = rate("1.0852");
    let yen = rate("160.15");
    let chf = rate("0.9634");
    let via_yen = (
        yen.coefficient() as i128 * 10_i128.pow(usd.scale()),
        usd.coefficient() as i128 * 10_i128.pow(yen.scale()),
    );
    let yen_to_chf = (
        chf.coefficient() as i128 * 10_i128.pow(yen.scale()),
        yen.coefficient() as i128 * 10_i128.pow(chf.scale()),
    );
    let direct = (
        chf.coefficient() as i128 * 10_i128.pow(usd.scale()),
        usd.coefficient() as i128 * 10_i128.pow(chf.scale()),
    );

    assert_eq!(
        via_yen.0 * yen_to_chf.0 * direct.1,
        via_yen.1 * yen_to_chf.1 * direct.0
    );
}

#[test]
fn rounding_rule_is_round_half_even() {
    assert_eq!(ROUNDING_RULE, "halfEven");
}
