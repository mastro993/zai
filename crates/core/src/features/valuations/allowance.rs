use crate::money::{ConversionRate, CurrencyCode, Money, convert};

/// Authored allowance restated into the active generation's target currency.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RestatedAllowance {
    pub converted: Option<Money>,
    pub complete: bool,
}

/// Restate an authored allowance at a period-start rate of transaction-exchange-rate class.
pub fn restate_authored_allowance(
    authored: Money,
    target: CurrencyCode,
    rate: &ConversionRate,
) -> crate::Result<RestatedAllowance> {
    let conversion = convert(authored, target, rate)?;
    Ok(RestatedAllowance {
        converted: conversion.converted,
        complete: conversion.complete,
    })
}
