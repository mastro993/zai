use super::CurrencySetupGate;
use super::events::{CurrencyStateEvent, CurrencyStateEventPublisher};
use super::models::{
    CurrencyBootstrap, CurrencyJob, CurrencyJobFinishState, CurrencyJobRecord, CurrencyJobType,
    CurrencyLifecycleStatus, CurrencyRefreshStatus, CurrencySettingsRow, CurrencyStatusView,
    ExchangeRateQuote, PersistedCurrency, SupportedCurrency,
};
use crate::money::{CURRENT_MANIFEST, CurrencyCode};
use crate::{Error, ErrorEnvelope, Result};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CurrencySetupState {
    pub default_currency: String,
    pub setup_completed: bool,
}

pub trait CurrencySettingsPort: Send + Sync {
    fn complete_initial_setup(&self, currency_code: &str) -> Result<()>;
    fn setup_state(&self) -> Result<CurrencySetupState>;
    fn require_setup(&self) -> Result<()>;
    fn list_persisted(&self) -> Result<Vec<PersistedCurrency>>;
    fn insert_job(&self, job: &CurrencyJob) -> Result<()>;
    fn update_job(&self, job: &CurrencyJob) -> Result<()>;
    fn get_job(&self, job_id: &str) -> Result<Option<CurrencyJobRecord>>;
    fn running_job(&self) -> Result<Option<CurrencyJobRecord>>;
    fn latest_job(&self) -> Result<Option<CurrencyJobRecord>>;
    fn enable_currency(&self, currency_code: &str) -> Result<()>;
    fn disable_currency(&self, currency_code: &str) -> Result<()>;
    fn prove_coverage(&self, currency_code: &str) -> Result<()>;
    fn provider_disclosure_accepted(&self) -> Result<bool>;
    fn accept_provider_disclosure(&self) -> Result<()>;
    fn has_ecb_retained_data(&self) -> Result<bool>;
    fn begin_default_generation(&self, currency_code: &str) -> Result<String>;
    fn activate_default_generation(&self, generation_id: &str, currency_code: &str) -> Result<()>;
    fn attach_generation(&self, job_id: &str, generation_id: &str) -> Result<()>;
    fn quote(&self, source: &str, target: &str, rate_date: &str) -> Result<ExchangeRateQuote>;
}

pub struct CurrencyService {
    pub(crate) settings: Arc<dyn CurrencySettingsPort>,
    pub(crate) events: Arc<dyn CurrencyStateEventPublisher>,
}

impl CurrencyService {
    pub fn new(
        settings: Arc<dyn CurrencySettingsPort>,
        events: Arc<dyn CurrencyStateEventPublisher>,
    ) -> Self {
        Self { settings, events }
    }

    pub fn complete_initial_setup(&self, currency_code: &str) -> Result<CurrencySetupState> {
        let currency = CurrencyCode::parse(currency_code)?;
        self.settings.complete_initial_setup(currency.as_str())?;
        self.settings.setup_state()
    }

    pub fn setup_state(&self) -> Result<CurrencySetupState> {
        self.settings.setup_state()
    }

    pub fn bootstrap(&self) -> Result<CurrencyBootstrap> {
        let state = self.settings.setup_state()?;
        Ok(CurrencyBootstrap {
            setup_complete: state.setup_completed,
            default_currency: state.setup_completed.then_some(state.default_currency),
        })
    }

    pub fn supported_catalog(&self) -> Vec<SupportedCurrency> {
        CURRENT_MANIFEST
            .currencies()
            .map(|record| SupportedCurrency {
                code: record.code.as_str().to_string(),
                name: record.name.to_string(),
            })
            .collect()
    }

    pub fn list_settings(&self) -> Result<Vec<CurrencySettingsRow>> {
        self.settings.require_setup()?;
        let state = self.settings.setup_state()?;
        Ok(assemble_settings_rows(
            self.settings.list_persisted()?,
            &state.default_currency,
            self.settings
                .running_job()?
                .as_ref()
                .map(|record| &record.job),
            self.settings
                .latest_job()?
                .as_ref()
                .map(|record| &record.job),
        ))
    }

    pub fn get_currency(&self, code: &str) -> Result<CurrencySettingsRow> {
        let currency = require_supported(code)?;
        self.list_settings()?
            .into_iter()
            .find(|row| row.code == currency.as_str())
            .ok_or_else(|| Error::NotFound(format!("Currency {}", currency.as_str())))
    }

    pub fn start_initial_setup(&self, currency_code: &str) -> Result<CurrencyJob> {
        let currency = require_supported(currency_code)?;
        let code = currency.as_str();
        if let Some(running) = self.settings.running_job()? {
            let state = self.settings.setup_state()?;
            let same_setup = running.job.job_type == CurrencyJobType::Setup
                && running.job.currency_code.as_deref() == Some(code);
            if same_setup && state.setup_completed {
                return self.mark_job_succeeded(running.job);
            }
            if same_setup && !state.setup_completed {
                return self.run_setup_job(running.job, code);
            }
            return Err(Error::CurrencyJobConflict);
        }

        let mut job = CurrencyJob::setup(format!("curjob-{}", Uuid::new_v4()), code);
        self.settings.insert_job(&job)?;
        self.publish(&CurrencyStateEvent::Started {
            job_id: job.job_id.clone(),
            job_type: CurrencyJobType::Setup,
        });
        job.stage_current = 1;
        self.publish(&CurrencyStateEvent::Progress {
            job_id: job.job_id.clone(),
            job_type: CurrencyJobType::Setup,
            stage_current: job.stage_current,
            stage_total: job.stage_total,
        });
        self.run_setup_job(job, code)
    }

    pub(crate) fn run_setup_job(&self, job: CurrencyJob, code: &str) -> Result<CurrencyJob> {
        match self.settings.complete_initial_setup(code) {
            Ok(()) => self.mark_job_succeeded(job),
            Err(error) => {
                let finished = job.finish_failed(setup_job_error_envelope(&error));
                self.settings.update_job(&finished)?;
                self.publish_finished(&finished, CurrencyJobFinishState::Failed);
                Err(error)
            }
        }
    }

    pub(crate) fn mark_job_succeeded(&self, job: CurrencyJob) -> Result<CurrencyJob> {
        let finished = job.finish_succeeded();
        self.settings.update_job(&finished)?;
        self.publish_finished(&finished, CurrencyJobFinishState::Succeeded);
        Ok(finished)
    }

    pub fn get_job(&self, job_id: &str) -> Result<CurrencyJob> {
        self.settings
            .get_job(job_id)?
            .map(|record| record.job)
            .ok_or_else(|| Error::CurrencyJobNotFound(job_id.to_string()))
    }

    pub fn status(&self) -> Result<CurrencyStatusView> {
        Ok(CurrencyStatusView {
            job: self
                .settings
                .running_job()?
                .or(self.settings.latest_job()?)
                .map(|record| record.job),
        })
    }

    pub(crate) fn publish(&self, event: &CurrencyStateEvent) {
        let _ = self.events.publish(event);
    }

    pub(crate) fn publish_finished(&self, job: &CurrencyJob, state: CurrencyJobFinishState) {
        self.publish(&CurrencyStateEvent::Finished {
            job_id: job.job_id.clone(),
            job_type: job.job_type,
            stage_current: job.stage_current,
            stage_total: job.stage_total,
            state,
        });
        self.publish(&CurrencyStateEvent::StateChanged);
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

pub(crate) fn require_supported(raw: &str) -> Result<CurrencyCode> {
    match CurrencyCode::parse(raw) {
        Ok(code) => Ok(code),
        Err(Error::InvalidData(message)) if message.starts_with("Unsupported currency code") => {
            Err(Error::UnsupportedCurrency(raw.trim().to_ascii_uppercase()))
        }
        Err(error) => Err(error),
    }
}

fn setup_job_error_envelope(error: &Error) -> ErrorEnvelope {
    job_error_envelope_with_prefix(error, "Initial currency setup failed")
}

pub(crate) fn job_error_envelope(error: &Error) -> ErrorEnvelope {
    job_error_envelope_with_prefix(error, "Currency job failed")
}

fn job_error_envelope_with_prefix(error: &Error, prefix: &str) -> ErrorEnvelope {
    let details = match error {
        Error::IncompleteCoverage { missing_periods } => {
            Some(serde_json::json!({ "missingPeriods": missing_periods }))
        }
        _ => None,
    };
    ErrorEnvelope {
        code: error.code(),
        message: format!("{prefix}: {}", error.public_message()),
        details,
    }
}

pub fn needs_provider(code: &str) -> bool {
    code != "EUR" && crate::features::exchange_rates::APPROVED_ECB_CURRENCIES.contains(&code)
}

fn assemble_settings_rows(
    persisted: Vec<PersistedCurrency>,
    default_currency: &str,
    running: Option<&CurrencyJob>,
    latest: Option<&CurrencyJob>,
) -> Vec<CurrencySettingsRow> {
    let mut rows: Vec<CurrencySettingsRow> = persisted
        .iter()
        .map(|row| settings_row(row, default_currency, running, latest))
        .collect();
    if let Some(job) = running.filter(|job| job.job_type == CurrencyJobType::AddCurrency)
        && let Some(code) = job.currency_code.as_deref()
        && !rows.iter().any(|row| row.code == code)
    {
        rows.push(synthetic_adding_row(code, default_currency));
    }
    if let Some(job) = latest.filter(|job| {
        job.job_type == CurrencyJobType::AddCurrency
            && job.status == super::models::CurrencyJobStatus::Failed
    }) && let Some(code) = job.currency_code.as_deref()
        && !rows.iter().any(|row| row.code == code)
        && running.is_none()
    {
        rows.push(synthetic_failed_row(code, default_currency, job));
    }
    rows
}

fn missing_periods_for(code: &str, latest: Option<&CurrencyJob>) -> Option<Vec<String>> {
    let job = latest?;
    if job.currency_code.as_deref() != Some(code) {
        return None;
    }
    missing_periods_from_job(job)
}

fn missing_periods_from_job(job: &CurrencyJob) -> Option<Vec<String>> {
    let details = job.error.as_ref()?.details.as_ref()?;
    let periods = details.get("missingPeriods")?.as_array()?;
    Some(
        periods
            .iter()
            .filter_map(|value| value.as_str().map(ToOwned::to_owned))
            .collect(),
    )
}

fn settings_row(
    row: &PersistedCurrency,
    default_currency: &str,
    running: Option<&CurrencyJob>,
    latest: Option<&CurrencyJob>,
) -> CurrencySettingsRow {
    let record = CURRENT_MANIFEST.get(&row.code);
    let adding = running.is_some_and(|job| {
        job.job_type == CurrencyJobType::AddCurrency
            && job.currency_code.as_deref() == Some(&row.code)
    });
    let failed = !adding
        && latest.is_some_and(|job| {
            job.job_type == CurrencyJobType::AddCurrency
                && job.status == super::models::CurrencyJobStatus::Failed
                && job.currency_code.as_deref() == Some(&row.code)
                && row.disabled
        });
    CurrencySettingsRow {
        code: row.code.clone(),
        name: record
            .map(|item| item.name.to_string())
            .unwrap_or_else(|| row.code.clone()),
        status: if adding {
            CurrencyLifecycleStatus::Adding
        } else if failed {
            CurrencyLifecycleStatus::Failed
        } else if row.disabled {
            CurrencyLifecycleStatus::Disabled
        } else {
            CurrencyLifecycleStatus::Enabled
        },
        coverage_from: row.coverage_from.clone(),
        coverage_to: row.coverage_to.clone(),
        last_refresh: row.last_refresh.clone(),
        refresh_status: row.refresh_status,
        missing_periods: missing_periods_for(&row.code, latest)
            .unwrap_or_else(|| row.missing_periods.clone()),
        used_by_recurring: row.used_by_recurring,
        is_default: row.code == default_currency,
    }
}

fn synthetic_failed_row(
    code: &str,
    default_currency: &str,
    job: &CurrencyJob,
) -> CurrencySettingsRow {
    let mut row = synthetic_adding_row(code, default_currency);
    row.status = CurrencyLifecycleStatus::Failed;
    row.missing_periods = missing_periods_from_job(job).unwrap_or_default();
    row
}

fn synthetic_adding_row(code: &str, default_currency: &str) -> CurrencySettingsRow {
    let record = CURRENT_MANIFEST.get(code);
    CurrencySettingsRow {
        code: code.to_string(),
        name: record
            .map(|item| item.name.to_string())
            .unwrap_or_else(|| code.to_string()),
        status: CurrencyLifecycleStatus::Adding,
        coverage_from: None,
        coverage_to: None,
        last_refresh: None,
        refresh_status: CurrencyRefreshStatus::Idle,
        missing_periods: Vec::new(),
        used_by_recurring: false,
        is_default: code == default_currency,
    }
}
