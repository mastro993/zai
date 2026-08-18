use super::jobs::{get_job, insert_job, latest_job, running_job, update_job};
use super::settings::list_persisted;
use super::{complete_initial_setup, require_setup, setup_state};
use crate::connection::DbPool;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::currency::{
    CurrencyJob, CurrencyJobRecord, CurrencySettingsPort, CurrencySetupState, PersistedCurrency,
};

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

    fn list_persisted(&self) -> Result<Vec<PersistedCurrency>> {
        list_persisted(&self.pool)
    }

    fn insert_job(&self, job: &CurrencyJob) -> Result<()> {
        insert_job(&self.pool, job)
    }

    fn update_job(&self, job: &CurrencyJob) -> Result<()> {
        update_job(&self.pool, job)
    }

    fn get_job(&self, job_id: &str) -> Result<Option<CurrencyJobRecord>> {
        get_job(&self.pool, job_id)
    }

    fn running_job(&self) -> Result<Option<CurrencyJobRecord>> {
        running_job(&self.pool)
    }

    fn latest_job(&self) -> Result<Option<CurrencyJobRecord>> {
        latest_job(&self.pool)
    }

    fn enable_currency(&self, currency_code: &str) -> Result<()> {
        super::lifecycle::enable_currency(&self.pool, currency_code)
    }

    fn disable_currency(&self, currency_code: &str) -> Result<()> {
        super::lifecycle::disable_currency(&self.pool, currency_code)
    }

    fn prove_coverage(&self, currency_code: &str) -> Result<()> {
        super::lifecycle::prove_coverage(&self.pool, currency_code)
    }

    fn provider_disclosure_accepted(&self) -> Result<bool> {
        super::lifecycle::provider_disclosure_accepted(&self.pool)
    }

    fn accept_provider_disclosure(&self) -> Result<()> {
        super::lifecycle::accept_provider_disclosure(&self.pool)
    }

    fn has_ecb_retained_data(&self) -> Result<bool> {
        super::lifecycle::has_ecb_retained_data(&self.pool)
    }

    fn begin_default_generation(&self, currency_code: &str) -> Result<String> {
        super::lifecycle::begin_default_generation(&self.pool, currency_code)
    }

    fn activate_default_generation(&self, generation_id: &str, currency_code: &str) -> Result<()> {
        super::lifecycle::activate_default_generation(&self.pool, generation_id, currency_code)
    }

    fn attach_generation(&self, job_id: &str, generation_id: &str) -> Result<()> {
        super::lifecycle::attach_generation(&self.pool, job_id, generation_id)
    }

    fn quote(
        &self,
        source: &str,
        target: &str,
        rate_date: &str,
    ) -> Result<zai_core::features::currency::ExchangeRateQuote> {
        super::lifecycle::quote(&self.pool, source, target, rate_date)
    }
}
