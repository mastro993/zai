use super::events::{CurrencyStateEvent, CurrencyStateEventBus};
use super::models::{
    CurrencyJobStatus, CurrencyJobType, CurrencyRefreshStatus, ExchangeRateQuote, QuoteVariant,
};
use super::service::{CurrencyService, CurrencySettingsPort, CurrencySetupState};
use crate::features::currency::models::{CurrencyJob, CurrencyJobRecord, PersistedCurrency};
use crate::{Error, ErrorCode, Result};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct MemorySettings {
    default_currency: String,
    setup_completed: bool,
    persisted: Vec<PersistedCurrency>,
    jobs: Vec<CurrencyJob>,
    disclosure_accepted: bool,
    coverage_ok: HashSet<String>,
    missing_periods: HashMap<String, Vec<String>>,
    generation_ids: HashMap<String, String>,
    active_generation: Option<String>,
    default_activated: Option<String>,
}

impl MemorySettings {
    fn new() -> Self {
        Self {
            default_currency: "EUR".to_string(),
            setup_completed: false,
            persisted: vec![eur_row()],
            jobs: Vec::new(),
            disclosure_accepted: false,
            coverage_ok: HashSet::from(["EUR".to_string()]),
            missing_periods: HashMap::new(),
            generation_ids: HashMap::new(),
            active_generation: None,
            default_activated: None,
        }
    }
}

impl CurrencySettingsPort for Mutex<MemorySettings> {
    fn complete_initial_setup(&self, currency_code: &str) -> Result<()> {
        let mut inner = self.lock().expect("lock");
        if inner.setup_completed && inner.default_currency != currency_code {
            return Err(Error::Conflict(
                "Initial currency setup is already complete".to_string(),
            ));
        }
        inner.default_currency = currency_code.to_string();
        inner.setup_completed = true;
        if !inner.persisted.iter().any(|row| row.code == currency_code) {
            inner.persisted.push(enabled_row(currency_code));
        }
        Ok(())
    }

    fn setup_state(&self) -> Result<CurrencySetupState> {
        let inner = self.lock().expect("lock");
        Ok(CurrencySetupState {
            default_currency: inner.default_currency.clone(),
            setup_completed: inner.setup_completed,
        })
    }

    fn require_setup(&self) -> Result<()> {
        if self.lock().expect("lock").setup_completed {
            Ok(())
        } else {
            Err(Error::SetupRequired)
        }
    }

    fn list_persisted(&self) -> Result<Vec<PersistedCurrency>> {
        Ok(self.lock().expect("lock").persisted.clone())
    }

    fn insert_job(&self, job: &CurrencyJob) -> Result<()> {
        let mut inner = self.lock().expect("lock");
        if inner
            .jobs
            .iter()
            .any(|existing| existing.status == CurrencyJobStatus::Running)
        {
            return Err(Error::CurrencyJobConflict);
        }
        inner.jobs.push(job.clone());
        Ok(())
    }

    fn update_job(&self, job: &CurrencyJob) -> Result<()> {
        let mut inner = self.lock().expect("lock");
        if let Some(existing) = inner
            .jobs
            .iter_mut()
            .find(|existing| existing.job_id == job.job_id)
        {
            *existing = job.clone();
        }
        Ok(())
    }

    fn get_job(&self, job_id: &str) -> Result<Option<CurrencyJobRecord>> {
        let inner = self.lock().expect("lock");
        Ok(inner
            .jobs
            .iter()
            .find(|job| job.job_id == job_id)
            .cloned()
            .map(|job| {
                let generation_id = inner.generation_ids.get(&job.job_id).cloned();
                CurrencyJobRecord { job, generation_id }
            }))
    }

    fn running_job(&self) -> Result<Option<CurrencyJobRecord>> {
        let inner = self.lock().expect("lock");
        Ok(inner
            .jobs
            .iter()
            .find(|job| job.status == CurrencyJobStatus::Running)
            .cloned()
            .map(|job| {
                let generation_id = inner.generation_ids.get(&job.job_id).cloned();
                CurrencyJobRecord { job, generation_id }
            }))
    }

    fn latest_job(&self) -> Result<Option<CurrencyJobRecord>> {
        let inner = self.lock().expect("lock");
        Ok(inner.jobs.last().cloned().map(|job| {
            let generation_id = inner.generation_ids.get(&job.job_id).cloned();
            CurrencyJobRecord { job, generation_id }
        }))
    }

    fn enable_currency(&self, currency_code: &str) -> Result<()> {
        let mut inner = self.lock().expect("lock");
        if let Some(row) = inner
            .persisted
            .iter_mut()
            .find(|row| row.code == currency_code)
        {
            row.disabled = false;
        } else {
            inner.persisted.push(enabled_row(currency_code));
        }
        Ok(())
    }

    fn disable_currency(&self, currency_code: &str) -> Result<()> {
        let mut inner = self.lock().expect("lock");
        if let Some(row) = inner
            .persisted
            .iter_mut()
            .find(|row| row.code == currency_code)
        {
            row.disabled = true;
            return Ok(());
        }
        Err(Error::NotFound(format!("Currency {currency_code}")))
    }

    fn prove_coverage(&self, currency_code: &str) -> Result<()> {
        let inner = self.lock().expect("lock");
        if let Some(missing) = inner.missing_periods.get(currency_code) {
            return Err(Error::IncompleteCoverage {
                missing_periods: missing.clone(),
            });
        }
        if inner.coverage_ok.contains(currency_code) || currency_code == "EUR" {
            return Ok(());
        }
        Err(Error::IncompleteCoverage {
            missing_periods: vec!["historical coverage".to_string()],
        })
    }

    fn provider_disclosure_accepted(&self) -> Result<bool> {
        Ok(self.lock().expect("lock").disclosure_accepted)
    }

    fn accept_provider_disclosure(&self) -> Result<()> {
        self.lock().expect("lock").disclosure_accepted = true;
        Ok(())
    }

    fn has_ecb_retained_data(&self) -> Result<bool> {
        Ok(self.lock().expect("lock").disclosure_accepted)
    }

    fn begin_default_generation(&self, currency_code: &str) -> Result<String> {
        let id = format!("gen-{currency_code}");
        self.lock().expect("lock").active_generation = Some(id.clone());
        Ok(id)
    }

    fn activate_default_generation(&self, generation_id: &str, currency_code: &str) -> Result<()> {
        let mut inner = self.lock().expect("lock");
        inner.default_currency = currency_code.to_string();
        inner.default_activated = Some(generation_id.to_string());
        Ok(())
    }

    fn attach_generation(&self, job_id: &str, generation_id: &str) -> Result<()> {
        self.lock()
            .expect("lock")
            .generation_ids
            .insert(job_id.to_string(), generation_id.to_string());
        Ok(())
    }

    fn quote(&self, source: &str, target: &str, rate_date: &str) -> Result<ExchangeRateQuote> {
        if source == target {
            return Ok(ExchangeRateQuote {
                source_currency: source.to_string(),
                target_currency: target.to_string(),
                rate_date: rate_date.to_string(),
                variant: QuoteVariant::Identity,
                rate: Some("1".to_string()),
                attribution: None,
                complete: true,
            });
        }
        Ok(ExchangeRateQuote {
            source_currency: source.to_string(),
            target_currency: target.to_string(),
            rate_date: rate_date.to_string(),
            variant: QuoteVariant::Pending,
            rate: None,
            attribution: None,
            complete: false,
        })
    }
}

fn eur_row() -> PersistedCurrency {
    enabled_row("EUR")
}

fn enabled_row(code: &str) -> PersistedCurrency {
    PersistedCurrency {
        code: code.to_string(),
        disabled: false,
        used_by_recurring: false,
        coverage_from: None,
        coverage_to: None,
        last_refresh: None,
        refresh_status: CurrencyRefreshStatus::Idle,
        missing_periods: Vec::new(),
    }
}

fn service() -> (
    CurrencyService,
    Arc<CurrencyStateEventBus>,
    Arc<Mutex<MemorySettings>>,
) {
    let settings = Arc::new(Mutex::new(MemorySettings::new()));
    let bus = CurrencyStateEventBus::new();
    (
        CurrencyService::new(settings.clone(), bus.clone()),
        bus,
        settings,
    )
}

#[test]
fn bootstrap_hides_unconfirmed_default_currency() {
    let (service, _, _) = service();
    let bootstrap = service.bootstrap().expect("bootstrap");
    assert!(!bootstrap.setup_complete);
    assert_eq!(bootstrap.default_currency, None);
}

#[test]
fn settings_read_fails_closed_before_setup() {
    let (service, _, _) = service();
    let error = service.list_settings().expect_err("setup required");
    assert_eq!(error.code(), ErrorCode::SetupRequired);
}

#[test]
fn catalog_is_available_before_setup() {
    let (service, _, _) = service();
    let catalog = service.supported_catalog();
    assert!(
        catalog
            .iter()
            .any(|item| item.code == "EUR" && item.name == "Euro")
    );
    assert!(catalog.iter().any(|item| item.code == "USD"));
}

#[test]
fn confirmed_setup_returns_finished_job_and_exposes_default() {
    let (service, bus, _) = service();
    let mut receiver = bus.subscribe();
    let job = service
        .start_initial_setup("EUR")
        .expect("setup should complete");
    assert_eq!(job.job_type, CurrencyJobType::Setup);
    assert_eq!(job.status, CurrencyJobStatus::Succeeded);
    assert_eq!(job.currency_code.as_deref(), Some("EUR"));

    let bootstrap = service.bootstrap().expect("bootstrap");
    assert!(bootstrap.setup_complete);
    assert_eq!(bootstrap.default_currency.as_deref(), Some("EUR"));

    let started = deserialize_next(&mut receiver);
    assert!(matches!(started, CurrencyStateEvent::Started { .. }));
    let _progress = deserialize_next(&mut receiver);
    let finished = deserialize_next(&mut receiver);
    assert!(matches!(
        finished,
        CurrencyStateEvent::Finished {
            state: crate::features::currency::models::CurrencyJobFinishState::Succeeded,
            ..
        }
    ));
    assert!(matches!(
        deserialize_next(&mut receiver),
        CurrencyStateEvent::StateChanged
    ));
}

#[test]
fn unsupported_setup_currency_is_refused_without_a_job() {
    let (service, _, settings) = service();
    let error = service.start_initial_setup("ZZZ").expect_err("unsupported");
    assert_eq!(error.code(), ErrorCode::UnsupportedCurrency);
    assert!(settings.lock().expect("lock").jobs.is_empty());
}

#[test]
fn second_running_setup_fails_conflict() {
    let (service, _, settings) = service();
    settings
        .lock()
        .expect("lock")
        .jobs
        .push(CurrencyJob::setup("job-open", "USD"));
    let error = service.start_initial_setup("EUR").expect_err("conflict");
    assert_eq!(error.code(), ErrorCode::CurrencyJobConflict);
}

#[test]
fn leftover_running_setup_job_is_adopted_instead_of_bricking() {
    let (service, _, settings) = service();
    settings
        .lock()
        .expect("lock")
        .jobs
        .push(CurrencyJob::setup("job-open", "EUR"));
    let job = service
        .start_initial_setup("EUR")
        .expect("adopt leftover setup job");
    assert_eq!(job.job_id, "job-open");
    assert_eq!(job.status, CurrencyJobStatus::Succeeded);
}

#[test]
fn unknown_job_is_not_found() {
    let (service, _, _) = service();
    let error = service.get_job("missing").expect_err("missing");
    assert_eq!(error.code(), ErrorCode::CurrencyJobNotFound);
}

fn deserialize_next(receiver: &mut tokio::sync::broadcast::Receiver<String>) -> CurrencyStateEvent {
    let payload = receiver.try_recv().expect("event");
    super::events::deserialize_currency_state_event(&payload).expect("decode")
}
