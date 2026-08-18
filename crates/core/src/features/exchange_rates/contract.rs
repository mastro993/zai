use chrono::NaiveDate;

use crate::money::CurrencyCode;

pub const ECB_HOST: &str = "data-api.ecb.europa.eu";
pub const USER_AGENT: &str = concat!("Zai/", env!("CARGO_PKG_VERSION"));
pub const PROVIDER_CONTRACT_ID: &str = "ecb-exr-d-sp00-v1";
pub const ECB_FLOW: &str = "EXR";
pub const ECB_FORMAT: &str = "csvdata";
pub const ECB_DETAIL: &str = "dataonly";
pub const ATTRIBUTION: &str = "European Central Bank";
pub const ZAI_CROSS_ATTRIBUTION: &str = "Zai calculation from ECB source legs";

pub const ECB_HISTORY_START: NaiveDate = match NaiveDate::from_ymd_opt(1999, 1, 4) {
    Some(date) => date,
    None => panic!("fixed ECB history start"),
};

/// Current ECB daily euro reference series present in manifest v1.
/// RUB excluded (suspended 2022-03-01). BGN omitted: not in manifest v1.
pub const APPROVED_ECB_CURRENCIES: &[&str] = &[
    "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "GBP", "HKD", "HUF", "IDR", "ILS", "INR",
    "ISK", "JPY", "KRW", "MXN", "MYR", "NOK", "NZD", "PHP", "PLN", "RON", "SEK", "SGD", "THB",
    "TRY", "USD", "ZAR",
];

pub fn is_approved_ecb_currency(code: CurrencyCode) -> bool {
    APPROVED_ECB_CURRENCIES.contains(&code.as_str())
}

pub fn approved_series_key() -> String {
    format!("D.{}.EUR.SP00.A", APPROVED_ECB_CURRENCIES.join("+"))
}

pub fn series_id_for(code: CurrencyCode) -> String {
    format!("EXR.D.{}.EUR.SP00.A", code.as_str())
}
