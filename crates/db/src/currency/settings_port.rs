use super::jobs::{get_job, insert_job, latest_job, running_job, update_job};
use super::settings::list_persisted;
use super::{complete_initial_setup, require_setup, setup_state};
use crate::connection::DbPool;
use crate::errors::IntoStorage;
use crate::write_actor::WriteHandle;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::currency::{
    CurrencyJob, CurrencyJobRecord, CurrencySettingsPort, CurrencySetupState, PersistedCurrency,
};

pub struct CurrencySettingsRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
}

impl CurrencySettingsRepository {
    pub(crate) fn new(pool: Arc<DbPool>, writer: WriteHandle) -> Self {
        Self { pool, writer }
    }
}

impl CurrencySettingsPort for CurrencySettingsRepository {
    fn complete_initial_setup(&self, currency_code: &str) -> Result<()> {
        let pool = Arc::clone(&self.pool);
        let currency_code = currency_code.to_string();
        self.writer.exec_sync(move |_connection| {
            complete_initial_setup(&pool, &currency_code).into_storage()
        })
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
        let pool = Arc::clone(&self.pool);
        let job = job.clone();
        self.writer
            .exec_sync(move |_connection| insert_job(&pool, &job).into_storage())
    }

    fn update_job(&self, job: &CurrencyJob) -> Result<()> {
        let pool = Arc::clone(&self.pool);
        let job = job.clone();
        self.writer
            .exec_sync(move |_connection| update_job(&pool, &job).into_storage())
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
        let pool = Arc::clone(&self.pool);
        let currency_code = currency_code.to_string();
        self.writer.exec_sync(move |_connection| {
            super::lifecycle::enable_currency(&pool, &currency_code).into_storage()
        })
    }

    fn disable_currency(&self, currency_code: &str) -> Result<()> {
        let pool = Arc::clone(&self.pool);
        let currency_code = currency_code.to_string();
        self.writer.exec_sync(move |_connection| {
            super::lifecycle::disable_currency(&pool, &currency_code).into_storage()
        })
    }

    fn prove_coverage(&self, currency_code: &str) -> Result<()> {
        super::lifecycle::prove_coverage(&self.pool, currency_code)
    }

    fn provider_disclosure_accepted(&self) -> Result<bool> {
        super::lifecycle::provider_disclosure_accepted(&self.pool)
    }

    fn accept_provider_disclosure(&self) -> Result<()> {
        let pool = Arc::clone(&self.pool);
        self.writer.exec_sync(move |_connection| {
            super::lifecycle::accept_provider_disclosure(&pool).into_storage()
        })
    }

    fn has_ecb_retained_data(&self) -> Result<bool> {
        super::lifecycle::has_ecb_retained_data(&self.pool)
    }

    fn begin_default_generation(&self, currency_code: &str) -> Result<String> {
        let pool = Arc::clone(&self.pool);
        let currency_code = currency_code.to_string();
        self.writer.exec_sync(move |_connection| {
            super::lifecycle::begin_default_generation(&pool, &currency_code).into_storage()
        })
    }

    fn activate_default_generation(&self, generation_id: &str, currency_code: &str) -> Result<()> {
        let pool = Arc::clone(&self.pool);
        let generation_id = generation_id.to_string();
        let currency_code = currency_code.to_string();
        self.writer.exec_sync(move |_connection| {
            super::lifecycle::activate_default_generation(&pool, &generation_id, &currency_code)
                .into_storage()
        })
    }

    fn attach_generation(&self, job_id: &str, generation_id: &str) -> Result<()> {
        let pool = Arc::clone(&self.pool);
        let job_id = job_id.to_string();
        let generation_id = generation_id.to_string();
        self.writer.exec_sync(move |_connection| {
            super::lifecycle::attach_generation(&pool, &job_id, &generation_id).into_storage()
        })
    }

    fn quote(
        &self,
        source: &str,
        target: &str,
        rate_date: &str,
    ) -> Result<zai_core::features::currency::ExchangeRateQuote> {
        super::lifecycle::quote(&self.pool, source, target, rate_date)
    }

    fn default_currency_revision(&self) -> Result<i32> {
        super::setup::default_currency_revision(&self.pool)
    }

    fn coverage_proof_digest(&self) -> Result<String> {
        let mut connection = crate::connection::get_connection(&self.pool)?;
        crate::exchange_rates::coverage_proof_digest(&mut connection)
    }
}
