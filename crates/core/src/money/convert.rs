use super::{CanonicalRate, ConversionRate, CurrencyCode, Money, RateVariantKind};
use crate::Error;
use num_bigint::{BigInt, Sign};

/// Result of a checked conversion. Pending rates stay incomplete and valueless.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Conversion {
    pub source: Money,
    pub converted: Option<Money>,
    pub complete: bool,
    pub variant: RateVariantKind,
}

pub fn convert(
    source: Money,
    target: CurrencyCode,
    rate: &ConversionRate,
) -> crate::Result<Conversion> {
    let same_currency = source.currency() == target;
    match rate {
        ConversionRate::Identity => {
            if !same_currency {
                return Err(Error::InvalidData(
                    "Cross-currency conversion cannot use an identity rate".to_string(),
                ));
            }
            Ok(complete(source, source, RateVariantKind::Identity))
        }
        ConversionRate::Pending { .. } => {
            if same_currency {
                return same_currency_requires_identity();
            }
            Ok(Conversion {
                source,
                converted: None,
                complete: false,
                variant: RateVariantKind::Pending,
            })
        }
        ConversionRate::Manual(manual_rate) => {
            if same_currency {
                return same_currency_requires_identity();
            }
            let converted = convert_with_rates(source, target, &CanonicalRate::one(), manual_rate)?;
            Ok(complete(source, converted, RateVariantKind::Manual))
        }
        ConversionRate::Automatic(automatic) => {
            if same_currency {
                return same_currency_requires_identity();
            }
            if automatic.rate_set_id.trim().is_empty() {
                return Err(Error::InvalidData(
                    "Automatic conversion requires a rate set identity".to_string(),
                ));
            }
            if automatic.source.currency != source.currency()
                || automatic.reference.currency != target
            {
                return Err(Error::InvalidData(
                    "Automatic conversion requires matching source and target currencies"
                        .to_string(),
                ));
            }
            if automatic.source.value_date != automatic.reference.value_date {
                return Err(Error::InvalidData(
                    "Automatic conversion requires the same value date on both legs".to_string(),
                ));
            }
            let converted = convert_with_rates(
                source,
                target,
                &automatic.source.rate,
                &automatic.reference.rate,
            )?;
            Ok(complete(source, converted, RateVariantKind::Automatic))
        }
    }
}

fn complete(source: Money, converted: Money, variant: RateVariantKind) -> Conversion {
    Conversion {
        source,
        converted: Some(converted),
        complete: true,
        variant,
    }
}

fn same_currency_requires_identity() -> crate::Result<Conversion> {
    Err(Error::InvalidData(
        "Same-currency conversion requires an identity rate".to_string(),
    ))
}

/// `amount_Y = amount_X * R[Y] / R[X]`, rounded once at the target ISO digits.
fn convert_with_rates(
    source: Money,
    target: CurrencyCode,
    source_rate: &CanonicalRate,
    target_rate: &CanonicalRate,
) -> crate::Result<Money> {
    let source_digits = i64::from(source.minor_unit_digits());
    let target_digits = i64::from(target.minor_unit_digits());
    let numerator = BigInt::from(source.minor_units())
        * pow10(target_digits)
        * BigInt::from(target_rate.coefficient())
        * pow10(i64::from(source_rate.scale()));
    let denominator = pow10(source_digits)
        * BigInt::from(source_rate.coefficient())
        * pow10(i64::from(target_rate.scale()));
    let minor_units = round_half_even(numerator, denominator)?;
    Money::new(minor_units, target)
}

fn pow10(exponent: i64) -> BigInt {
    debug_assert!(exponent >= 0);
    let mut value = BigInt::from(1);
    for _ in 0..exponent {
        value *= 10;
    }
    value
}

fn round_half_even(numerator: BigInt, denominator: BigInt) -> crate::Result<i64> {
    if denominator.sign() != Sign::Plus {
        return Err(Error::InvalidData(
            "Exchange rate must be a positive finite decimal".to_string(),
        ));
    }
    let quotient = &numerator / &denominator;
    let remainder = &numerator % &denominator;
    let rounded = if remainder.sign() == Sign::NoSign {
        quotient
    } else {
        let twice_remainder: BigInt = &remainder * 2;
        match twice_remainder.cmp(&denominator) {
            std::cmp::Ordering::Less => quotient,
            std::cmp::Ordering::Greater => quotient + 1,
            std::cmp::Ordering::Equal => {
                if is_even(&quotient) {
                    quotient
                } else {
                    quotient + 1
                }
            }
        }
    };
    bigint_to_minor_units(&rounded)
}

fn is_even(value: &BigInt) -> bool {
    let (_, digits) = value.to_u64_digits();
    digits.first().is_none_or(|digit| digit % 2 == 0)
}

fn bigint_to_minor_units(value: &BigInt) -> crate::Result<i64> {
    match value.to_u64_digits() {
        (Sign::NoSign, _) => Ok(0),
        (Sign::Plus, digits) if digits.len() == 1 && digits[0] <= i64::MAX as u64 => {
            Ok(digits[0] as i64)
        }
        (Sign::Plus, digits) if digits.is_empty() => Ok(0),
        _ => Err(Error::CalculationOverflow(
            "converted minor-unit result exceeds i64".to_string(),
        )),
    }
}
