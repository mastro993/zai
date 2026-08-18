mod contract;
mod cross;
mod payload;
mod ports;
mod privacy;
mod request;
mod service;

#[cfg(test)]
mod cross_tests;
#[cfg(test)]
mod payload_tests;
#[cfg(test)]
mod privacy_tests;
#[cfg(test)]
mod request_tests;
#[cfg(test)]
mod service_tests;

pub use contract::{
    APPROVED_ECB_CURRENCIES, ATTRIBUTION, ECB_HISTORY_START, ECB_HOST, PROVIDER_CONTRACT_ID,
    USER_AGENT, ZAI_CROSS_ATTRIBUTION, approved_series_key, is_approved_ecb_currency,
};
pub use cross::{
    RateSource, automatic_pair, eur_identity_observation, legs_for_pair, pair_attribution,
    rate_source_for,
};
pub use payload::{
    AcceptedObservation, AcceptedRateSet, FailureClass, ProviderPayload, parse_ecb_csv,
    validate_complete_set,
};
pub use ports::{
    ExchangeRateCache, ExchangeRateProvider, ProviderFetchResult, SyncMetadata, UtcClock,
};
pub use privacy::{refresh_failure_public_facts, refresh_log_line};
pub use request::{
    ProviderRequest, build_initial_requests, build_refresh_request, request_contains_forbidden,
};
pub use service::{ExchangeRateService, RefreshOutcome, SystemUtcClock};
