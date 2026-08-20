mod amount;
mod convert;
mod coverage;
mod currency;
mod generated;
mod manifest;
mod rate;

#[cfg(test)]
mod amount_tests;
#[cfg(test)]
mod convert_tests;
#[cfg(test)]
mod coverage_tests;
#[cfg(test)]
mod manifest_tests;
#[cfg(test)]
mod rate_tests;

pub use amount::{Money, WIRE_MAX_MINOR_UNITS, format_minor_units};
pub use convert::{Conversion, convert};
pub use coverage::{
    CoverageResolution, PublicationDay, coverage_interval_is_complete, resolve_coverage,
};
pub use currency::CurrencyCode;
pub use generated::{
    CANDIDATE_COUNT, CLDR_SHA256, CLDR_SOURCE_URL, CLDR_VERSION, MANIFEST_VERSION,
    SIX_PUBLICATION_DATE, SIX_SHA256, SIX_SOURCE_URL,
};
pub use manifest::{CURRENT_MANIFEST, CurrencyManifest, CurrencyRecord};
pub use rate::{
    AutomaticRate, CONVERSION_FORMULA_VERSION, CanonicalRate, ConversionRate, ROUNDING_RULE,
    RateObservation, RateVariantKind,
};
