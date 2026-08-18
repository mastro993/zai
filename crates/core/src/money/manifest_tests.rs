use super::{
    CANDIDATE_COUNT, CLDR_SHA256, CLDR_SOURCE_URL, CLDR_VERSION, CURRENT_MANIFEST, CurrencyCode,
    MANIFEST_VERSION, SIX_PUBLICATION_DATE, SIX_SHA256,
};
use chrono::NaiveDate;

const RESEARCH_CANDIDATES: &str = "\
AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BHD BIF BMD BND BOB BRL BSD \
BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP \
ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS \
INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR \
LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN \
NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD \
SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY \
TTD TWD TZS UAH UGX USD UYU UZS VED VES VND VUV WST XAF XCD XCG XOF XPF YER \
ZAR ZMW ZWG";

const EXCLUDED_CODES: &[&str] = &[
    "BOV", "CHE", "CHW", "CLF", "COU", "MXV", "USN", "UYI", "UYW", "XAD", "XAG", "XAU", "XPD",
    "XPT", "XBA", "XBB", "XBC", "XBD", "XDR", "XSU", "XUA", "XTS", "XXX",
];

fn date(year: i32, month: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(year, month, day).expect("fixture date")
}

#[test]
fn current_manifest_contains_exactly_the_research_candidate_set() {
    let expected: Vec<_> = RESEARCH_CANDIDATES.split_whitespace().collect();
    let actual: Vec<_> = CURRENT_MANIFEST
        .currencies()
        .map(|record| record.code.as_str())
        .collect();

    assert_eq!(expected.len(), CANDIDATE_COUNT);
    assert_eq!(actual.len(), CANDIDATE_COUNT);
    assert_eq!(actual, expected);
}

#[test]
fn current_manifest_pins_six_and_cldr_source_versions() {
    assert_eq!(MANIFEST_VERSION, "1");
    assert_eq!(SIX_PUBLICATION_DATE, "2026-01-01");
    assert_eq!(CLDR_VERSION, "48.2");
    assert!(CLDR_SOURCE_URL.contains("raw.githubusercontent.com"));
    assert_eq!(
        SIX_SHA256,
        "838dfb991648cf36df939edd5fe3811737962b75a32252847d239cedd1e291c9"
    );
    assert_eq!(
        CLDR_SHA256,
        "cd2af39aef82fdbfba4d591c87548203350538ad2318486d104b3b38b8d62f1a"
    );
}

#[test]
fn current_manifest_excludes_funds_metals_and_non_fiat_codes() {
    for code in EXCLUDED_CODES {
        assert!(CURRENT_MANIFEST.get(code).is_none(), "{code} must stay out");
    }
}

#[test]
fn current_manifest_uses_iso_minor_unit_digits_not_two_by_default() {
    assert_eq!(
        CURRENT_MANIFEST.require("EUR").unwrap().minor_unit_digits,
        2
    );
    assert_eq!(
        CURRENT_MANIFEST.require("JPY").unwrap().minor_unit_digits,
        0
    );
    assert_eq!(
        CURRENT_MANIFEST.require("BHD").unwrap().minor_unit_digits,
        3
    );
    assert_eq!(
        CURRENT_MANIFEST.require("CLP").unwrap().minor_unit_digits,
        0
    );
}

#[test]
fn current_manifest_rejects_codes_with_absent_iso_digits() {
    assert!(CURRENT_MANIFEST.get("XDR").is_none());
    assert!(CURRENT_MANIFEST.get("XXX").is_none());
}

#[test]
fn current_manifest_keeps_iso_numeric_codes() {
    assert_eq!(CURRENT_MANIFEST.require("USD").unwrap().numeric_code, 840);
    assert_eq!(CURRENT_MANIFEST.require("EUR").unwrap().numeric_code, 978);
}

#[test]
fn current_manifest_records_approved_validity_intervals() {
    let euro = CURRENT_MANIFEST.require("EUR").unwrap();
    let guilder = CURRENT_MANIFEST.require("XCG").unwrap();
    let ved = CURRENT_MANIFEST.require("VED").unwrap();

    assert_eq!(euro.valid_from, date(1999, 1, 1));
    assert_eq!(guilder.valid_from, date(2025, 3, 31));
    assert_eq!(ved.valid_from, date(2021, 10, 1));
    assert_eq!(euro.valid_to, None);
}

#[test]
fn currency_record_rejects_dates_before_approved_inception() {
    let euro = CURRENT_MANIFEST.require("EUR").unwrap();

    assert!(!euro.is_valid_on(date(1998, 12, 31)));
    assert!(euro.is_valid_on(date(1999, 1, 1)));
}

#[test]
fn currency_code_parse_accepts_only_manifest_candidates() {
    assert_eq!(CurrencyCode::parse("chf").unwrap().as_str(), "CHF");
    assert!(CurrencyCode::parse("BOV").is_err());
    assert!(CurrencyCode::parse("US$").is_err());
}

#[test]
fn fiat_x_codes_remain_candidates() {
    for code in ["XAF", "XCD", "XCG", "XOF", "XPF"] {
        assert!(CURRENT_MANIFEST.get(code).is_some(), "{code}");
    }
}
