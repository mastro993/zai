use chrono::NaiveDate;

use crate::money::{AutomaticRate, CanonicalRate, ConversionRate, CurrencyCode, RateObservation};

use super::contract::{ATTRIBUTION, ZAI_CROSS_ATTRIBUTION};
use super::payload::AcceptedRateSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RateSource {
    Identity,
    AutomaticEcb,
    ManualOnly,
}

pub fn eur_identity_observation(value_date: NaiveDate) -> RateObservation {
    RateObservation {
        currency: CurrencyCode::parse("EUR").expect("EUR"),
        value_date,
        rate: CanonicalRate::one(),
    }
}

pub fn rate_source_for(currency: CurrencyCode, accepted: Option<&AcceptedRateSet>) -> RateSource {
    if currency.as_str() == "EUR" {
        return RateSource::Identity;
    }
    let Some(accepted) = accepted else {
        return RateSource::ManualOnly;
    };
    if accepted
        .observations
        .iter()
        .any(|observation| observation.currency == currency)
    {
        RateSource::AutomaticEcb
    } else {
        RateSource::ManualOnly
    }
}

pub fn pair_attribution(source: CurrencyCode, target: CurrencyCode) -> &'static str {
    if source.as_str() != "EUR" && target.as_str() != "EUR" {
        ZAI_CROSS_ATTRIBUTION
    } else {
        ATTRIBUTION
    }
}

pub fn automatic_pair(
    rate_set_id: &str,
    source: RateObservation,
    reference: RateObservation,
) -> crate::Result<ConversionRate> {
    if rate_set_id.trim().is_empty() {
        return Err(crate::Error::InvalidData(
            "Automatic conversion requires a rate set identity".to_string(),
        ));
    }
    if source.value_date != reference.value_date {
        return Err(crate::Error::InvalidData(
            "Automatic conversion requires the same value date on both legs".to_string(),
        ));
    }
    Ok(ConversionRate::Automatic(AutomaticRate {
        rate_set_id: rate_set_id.to_string(),
        source,
        reference,
    }))
}

pub fn legs_for_pair(
    accepted: &AcceptedRateSet,
    source: CurrencyCode,
    target: CurrencyCode,
    value_date: NaiveDate,
) -> crate::Result<(RateObservation, RateObservation)> {
    Ok((
        observation_or_eur(accepted, source, value_date)?,
        observation_or_eur(accepted, target, value_date)?,
    ))
}

fn observation_or_eur(
    accepted: &AcceptedRateSet,
    currency: CurrencyCode,
    value_date: NaiveDate,
) -> crate::Result<RateObservation> {
    if currency.as_str() == "EUR" {
        return Ok(eur_identity_observation(value_date));
    }
    accepted
        .observations
        .iter()
        .find(|observation| {
            observation.currency == currency && observation.value_date == value_date
        })
        .map(|observation| RateObservation {
            currency: observation.currency,
            value_date: observation.value_date,
            rate: observation.rate.clone(),
        })
        .ok_or_else(|| {
            crate::Error::InvalidData(format!(
                "No ECB observation for {} on {value_date}",
                currency.as_str()
            ))
        })
}
