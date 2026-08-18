use super::{complete_initial_setup, require_setup, setup_state};
use crate::connection::DbPool;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::currency::{CurrencySettingsPort, CurrencySetupState};

pub struct CurrencySettingsRepository {
    pool: Arc<DbPool>,
}

impl CurrencySettingsRepository {
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }
}

impl CurrencySettingsPort for CurrencySettingsRepository {
    fn complete_initial_setup(&self, currency_code: &str) -> Result<()> {
        complete_initial_setup(&self.pool, currency_code)
    }

    fn setup_state(&self) -> Result<CurrencySetupState> {
        let (default_currency, setup_completed) = setup_state(&self.pool)?;
        Ok(CurrencySetupState {
            default_currency,
            setup_completed,
        })
    }

    fn require_setup(&self) -> Result<()> {
        require_setup(&self.pool)
    }
}
