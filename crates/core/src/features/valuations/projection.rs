use crate::money::{ConversionRate, CurrencyCode, Money, convert};

/// Live or last-known-good projection quote. Missing pair omits the occurrence.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectionQuote {
    pub rate: ConversionRate,
    pub stale: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectedConversion {
    pub converted: Option<Money>,
    pub omitted: bool,
    pub stale: bool,
    pub complete: bool,
}

/// Convert one projected occurrence at the projection-rate head.
pub fn convert_projected(
    source: Money,
    target: CurrencyCode,
    quote: Option<&ProjectionQuote>,
) -> crate::Result<ProjectedConversion> {
    let Some(quote) = quote else {
        return Ok(ProjectedConversion {
            converted: None,
            omitted: true,
            stale: false,
            complete: false,
        });
    };
    let conversion = convert(source, target, &quote.rate)?;
    if !conversion.complete {
        return Ok(ProjectedConversion {
            converted: None,
            omitted: true,
            stale: quote.stale,
            complete: false,
        });
    }
    Ok(ProjectedConversion {
        converted: conversion.converted,
        omitted: false,
        stale: quote.stale,
        complete: true,
    })
}
