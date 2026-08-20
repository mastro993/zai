mod alerts;
mod events;
mod gate;
#[cfg(test)]
mod lifecycle_tests;
mod models;
mod service;
mod service_lifecycle;
#[cfg(test)]
mod service_tests;

pub use alerts::{
    CURRENCY_REFRESH_FAILURE_OCCURRENCE_KEY, CURRENCY_REFRESH_FAILURE_PRODUCER_KEY,
    build_refresh_failure_alert,
};
pub use events::{
    CURRENCY_STATE_EVENT_NAME, CURRENCY_STATE_EVENT_VERSION, CurrencyStateEvent,
    CurrencyStateEventBus, CurrencyStateEventPublisher, CurrencyStatePublicationError,
    NoopCurrencyStatePublisher, deserialize_currency_state_event, serialize_currency_state_event,
};
pub use gate::{AllowCurrencySetup, CurrencySetupGate};
pub use models::{
    CurrencyBootstrap, CurrencyJob, CurrencyJobFinishState, CurrencyJobRecord, CurrencyJobStatus,
    CurrencyJobType, CurrencyLifecycleStatus, CurrencyRefreshStatus, CurrencySettingsRow,
    CurrencyStatusView, ExchangeRateQuote, PersistedCurrency, QuoteVariant, SupportedCurrency,
};
pub use service::{CurrencyService, CurrencySettingsPort, CurrencySetupState, needs_provider};
