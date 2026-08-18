use std::collections::{BTreeMap, BTreeSet};

use chrono::NaiveDate;
use sha2::{Digest, Sha256};

use crate::money::{CanonicalRate, CurrencyCode};

use super::contract::{
    APPROVED_ECB_CURRENCIES, ATTRIBUTION, is_approved_ecb_currency, series_id_for,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FailureClass {
    Transport,
    Timeout,
    HttpStatus,
    TooLarge,
    Redirect,
    Validation,
    AllowList,
    Internal,
}

impl FailureClass {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Transport => "transport",
            Self::Timeout => "timeout",
            Self::HttpStatus => "httpStatus",
            Self::TooLarge => "tooLarge",
            Self::Redirect => "redirect",
            Self::Validation => "validation",
            Self::AllowList => "allowList",
            Self::Internal => "internal",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderPayload {
    pub body: String,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AcceptedObservation {
    pub currency: CurrencyCode,
    pub series_id: String,
    pub value_date: NaiveDate,
    pub rate: CanonicalRate,
    pub attribution: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AcceptedRateSet {
    pub id: String,
    pub revision_identity: String,
    pub payload_digest: String,
    pub observations: Vec<AcceptedObservation>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedObservation {
    pub currency: CurrencyCode,
    pub value_date: NaiveDate,
    pub original_decimal: String,
    pub deleted: bool,
}

pub fn parse_ecb_csv(body: &str) -> Result<Vec<ParsedObservation>, FailureClass> {
    let mut lines = body.lines().filter(|line| !line.trim().is_empty());
    let header = lines.next().ok_or(FailureClass::Validation)?;
    let columns = split_csv(header);
    let currency_idx = column_index(&columns, "CURRENCY")?;
    let date_idx = column_index(&columns, "TIME_PERIOD")?;
    let value_idx = column_index(&columns, "OBS_VALUE")?;
    let mut parsed = Vec::new();
    for line in lines {
        let fields = split_csv(line);
        let currency_raw = fields.get(currency_idx).ok_or(FailureClass::Validation)?;
        let date_raw = fields.get(date_idx).ok_or(FailureClass::Validation)?;
        let value_raw = fields.get(value_idx).map(String::as_str).unwrap_or("");
        let currency = CurrencyCode::parse(currency_raw).map_err(|_| FailureClass::Validation)?;
        if !is_approved_ecb_currency(currency) {
            return Err(FailureClass::Validation);
        }
        let value_date = NaiveDate::parse_from_str(date_raw, "%Y-%m-%d")
            .map_err(|_| FailureClass::Validation)?;
        parsed.push(ParsedObservation {
            currency,
            value_date,
            original_decimal: value_raw.trim().to_string(),
            deleted: value_raw.trim().is_empty(),
        });
    }
    Ok(parsed)
}

pub fn validate_complete_set(
    chunks: &[ParsedObservation],
    previous: Option<&AcceptedRateSet>,
    set_id: String,
) -> Result<AcceptedRateSet, FailureClass> {
    let mut by_key: BTreeMap<(String, NaiveDate), ParsedObservation> = BTreeMap::new();
    if let Some(previous) = previous {
        for observation in &previous.observations {
            by_key.insert(
                (
                    observation.currency.as_str().to_string(),
                    observation.value_date,
                ),
                ParsedObservation {
                    currency: observation.currency,
                    value_date: observation.value_date,
                    original_decimal: observation.rate.original_decimal().to_string(),
                    deleted: false,
                },
            );
        }
    }
    for observation in chunks {
        let key = (
            observation.currency.as_str().to_string(),
            observation.value_date,
        );
        if observation.deleted {
            by_key.remove(&key);
            continue;
        }
        by_key.insert(key, observation.clone());
    }

    let mut observations = Vec::new();
    let mut currencies = BTreeSet::new();
    for observation in by_key.into_values() {
        if observation.deleted {
            continue;
        }
        let rate = CanonicalRate::parse(&observation.original_decimal)
            .map_err(|_| FailureClass::Validation)?;
        currencies.insert(observation.currency.as_str());
        observations.push(AcceptedObservation {
            series_id: series_id_for(observation.currency),
            currency: observation.currency,
            value_date: observation.value_date,
            rate,
            attribution: ATTRIBUTION.to_string(),
        });
    }
    observations.sort_by(|left, right| {
        left.currency
            .as_str()
            .cmp(right.currency.as_str())
            .then(left.value_date.cmp(&right.value_date))
    });
    if observations.is_empty() {
        return Err(FailureClass::Validation);
    }
    for approved in APPROVED_ECB_CURRENCIES {
        if !currencies.contains(approved) {
            return Err(FailureClass::Validation);
        }
    }
    let payload_digest = digest_observations(&observations);
    Ok(AcceptedRateSet {
        id: set_id,
        revision_identity: payload_digest.clone(),
        payload_digest,
        observations,
    })
}

fn digest_observations(observations: &[AcceptedObservation]) -> String {
    let mut hasher = Sha256::new();
    for observation in observations {
        hasher.update(observation.currency.as_str().as_bytes());
        hasher.update(b",");
        hasher.update(observation.value_date.to_string().as_bytes());
        hasher.update(b",");
        hasher.update(observation.rate.original_decimal().as_bytes());
        hasher.update(b"\n");
    }
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn column_index(columns: &[String], name: &str) -> Result<usize, FailureClass> {
    columns
        .iter()
        .position(|column| column == name)
        .ok_or(FailureClass::Validation)
}

fn split_csv(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    for character in line.chars() {
        match character {
            '"' => in_quotes = !in_quotes,
            ',' if !in_quotes => {
                fields.push(std::mem::take(&mut current));
            }
            _ => current.push(character),
        }
    }
    fields.push(current);
    fields
}
