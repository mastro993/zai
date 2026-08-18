use chrono::NaiveDate;

use crate::money::{CurrencyCode, Money, convert};

use super::contract::APPROVED_ECB_CURRENCIES;
use super::contract::{ATTRIBUTION, ZAI_CROSS_ATTRIBUTION};
use super::cross::{
    RateSource, automatic_pair, eur_identity_observation, legs_for_pair, pair_attribution,
    rate_source_for,
};
use super::payload::{parse_ecb_csv, validate_complete_set};

fn date() -> NaiveDate {
    NaiveDate::from_ymd_opt(2026, 8, 17).expect("date")
}

fn accepted_set() -> super::payload::AcceptedRateSet {
    let mut body = String::from("CURRENCY,TIME_PERIOD,OBS_VALUE\n");
    for code in APPROVED_ECB_CURRENCIES {
        let value = if *code == "USD" {
            "1.10"
        } else if *code == "GBP" {
            "0.85"
        } else {
            "2.00"
        };
        body.push_str(&format!("{code},2026-08-17,{value}\n"));
    }
    let parsed = parse_ecb_csv(&body).expect("parse");
    validate_complete_set(&parsed, None, "set-1".to_string()).expect("set")
}

#[test]
fn currency_outside_validated_intersection_is_manual_only() {
    let set = accepted_set();
    assert_eq!(
        rate_source_for(CurrencyCode::parse("EUR").unwrap(), Some(&set)),
        RateSource::Identity
    );
    assert_eq!(
        rate_source_for(CurrencyCode::parse("USD").unwrap(), Some(&set)),
        RateSource::AutomaticEcb
    );
    assert_eq!(
        rate_source_for(CurrencyCode::parse("ARS").unwrap(), Some(&set)),
        RateSource::ManualOnly
    );
    assert_eq!(
        rate_source_for(CurrencyCode::parse("USD").unwrap(), None),
        RateSource::ManualOnly
    );
}

#[test]
fn eur_cross_rate_keeps_both_ecb_legs_and_converts() {
    let set = accepted_set();
    let usd = CurrencyCode::parse("USD").unwrap();
    let gbp = CurrencyCode::parse("GBP").unwrap();
    let (source, reference) = legs_for_pair(&set, usd, gbp, date()).expect("legs");
    assert_eq!(source.rate.original_decimal(), "1.10");
    assert_eq!(reference.rate.original_decimal(), "0.85");
    let rate = automatic_pair(&set.id, source, reference).expect("pair");
    let converted = convert(Money::from_authored(110, "USD").unwrap(), gbp, &rate).unwrap();
    assert!(converted.complete);
    assert_eq!(converted.converted.unwrap().minor_units(), 85);
    assert_eq!(pair_attribution(usd, gbp), ZAI_CROSS_ATTRIBUTION);
}

#[test]
fn usd_to_eur_uses_identity_eur_leg() {
    let set = accepted_set();
    let usd = CurrencyCode::parse("USD").unwrap();
    let eur = CurrencyCode::parse("EUR").unwrap();
    let (source, reference) = legs_for_pair(&set, usd, eur, date()).expect("legs");
    assert_eq!(reference, eur_identity_observation(date()));
    let rate = automatic_pair(&set.id, source, reference).expect("pair");
    let converted = convert(Money::from_authored(110, "USD").unwrap(), eur, &rate).unwrap();
    assert_eq!(converted.converted.unwrap().minor_units(), 100);
    assert_eq!(pair_attribution(usd, eur), ATTRIBUTION);
}
