use chrono::NaiveDate;

use super::contract::APPROVED_ECB_CURRENCIES;
use super::payload::{FailureClass, parse_ecb_csv, validate_complete_set};

fn date(year: i32, month: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(year, month, day).expect("date")
}

fn complete_csv() -> String {
    let mut body = String::from(
        "KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE\n",
    );
    for (index, code) in APPROVED_ECB_CURRENCIES.iter().enumerate() {
        let value = format!("1.{index:02}");
        body.push_str(&format!(
            "EXR.D.{code}.EUR.SP00.A,D,{code},EUR,SP00,A,2026-08-17,{value}\n"
        ));
    }
    body
}

#[test]
fn parse_rejects_unexpected_series() {
    let body = "CURRENCY,TIME_PERIOD,OBS_VALUE\nARS,2026-08-17,1.2\n";
    assert_eq!(parse_ecb_csv(body), Err(FailureClass::Validation));
}

#[test]
fn parse_and_validate_complete_fixed_set() {
    let parsed = parse_ecb_csv(&complete_csv()).expect("parse");
    assert_eq!(parsed.len(), APPROVED_ECB_CURRENCIES.len());
    let set = validate_complete_set(&parsed, None, "set-1".to_string()).expect("validate");
    assert_eq!(set.observations.len(), APPROVED_ECB_CURRENCIES.len());
    assert_eq!(set.payload_digest.len(), 64);
    assert_eq!(set.revision_identity, set.payload_digest);
    assert!(
        set.observations
            .iter()
            .all(|observation| observation.value_date == date(2026, 8, 17))
    );
}

#[test]
fn validate_rejects_incomplete_set() {
    let body = "CURRENCY,TIME_PERIOD,OBS_VALUE\nUSD,2026-08-17,1.10\n";
    let parsed = parse_ecb_csv(body).expect("parse");
    assert_eq!(
        validate_complete_set(&parsed, None, "set-1".to_string()),
        Err(FailureClass::Validation)
    );
}

#[test]
fn validate_merges_delta_onto_last_known_good() {
    let parsed = parse_ecb_csv(&complete_csv()).expect("parse");
    let previous = validate_complete_set(&parsed, None, "set-1".to_string()).expect("previous");
    let delta =
        parse_ecb_csv("CURRENCY,TIME_PERIOD,OBS_VALUE\nUSD,2026-08-18,1.11\n").expect("delta");
    let next = validate_complete_set(&delta, Some(&previous), "set-2".to_string()).expect("next");
    assert_eq!(next.observations.len(), APPROVED_ECB_CURRENCIES.len() + 1);
    let usd_new = next
        .observations
        .iter()
        .find(|observation| {
            observation.currency.as_str() == "USD" && observation.value_date == date(2026, 8, 18)
        })
        .expect("usd revision");
    assert_eq!(usd_new.rate.original_decimal(), "1.11");
}

#[test]
fn validate_rejects_non_positive_decimal() {
    let body = complete_csv().replace(
        &format!(
            "USD,EUR,SP00,A,2026-08-17,1.{:02}",
            APPROVED_ECB_CURRENCIES
                .iter()
                .position(|code| *code == "USD")
                .expect("usd")
        ),
        "USD,EUR,SP00,A,2026-08-17,0",
    );
    let parsed = parse_ecb_csv(&body).expect("parse");
    assert_eq!(
        validate_complete_set(&parsed, None, "set-1".to_string()),
        Err(FailureClass::Validation)
    );
}
