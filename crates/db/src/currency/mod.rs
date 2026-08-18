mod activation;
#[cfg(any(test, feature = "failpoints"))]
pub mod failpoints;
mod format;
mod jobs;
mod lifecycle;
mod settings;
mod settings_port;
mod setup;

pub(crate) use activation::{activate_currency_schema, maybe_confirm_default_currency};
pub use format::{
    APPLICATION_FORMAT_V1, ClientFormat, application_format_present, assert_client_format,
};
pub(crate) use lifecycle::{
    enable_currency_on, prove_coverage_on, quote_on, require_enabled_currency,
};
pub use settings_port::CurrencySettingsRepository;
pub use setup::{
    complete_initial_setup, default_currency, default_currency_revision, insert_identity_rate,
    require_setup, require_setup_on_connection, setup_is_complete, setup_state,
};
