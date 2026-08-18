use super::CurrencySetupGate;
use crate::Result;
use crate::money::CurrencyCode;
use std::sync::Arc;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CurrencySetupState {
    pub default_currency: String,
    pub setup_completed: bool,
}

pub trait CurrencySettingsPort: Send + Sync {
    fn complete_initial_setup(&self, currency_code: &str) -> Result<()>;
    fn setup_state(&self) -> Result<CurrencySetupState>;
    fn require_setup(&self) -> Result<()>;
}

pub struct CurrencyService {
    settings: Arc<dyn CurrencySettingsPort>,
}

impl CurrencyService {
    pub fn new(settings: Arc<dyn CurrencySettingsPort>) -> Self {
        Self { settings }
    }

    pub fn complete_initial_setup(&self, currency_code: &str) -> Result<CurrencySetupState> {
        let currency = CurrencyCode::parse(currency_code)?;
        self.settings.complete_initial_setup(currency.as_str())?;
        self.settings.setup_state()
    }

    pub fn setup_state(&self) -> Result<CurrencySetupState> {
        self.settings.setup_state()
    }
}

impl CurrencySetupGate for CurrencyService {
    fn require_setup(&self) -> Result<()> {
        self.settings.require_setup()
    }
}

impl CurrencySetupGate for Arc<CurrencyService> {
    fn require_setup(&self) -> Result<()> {
        CurrencyService::require_setup(self)
    }
}
