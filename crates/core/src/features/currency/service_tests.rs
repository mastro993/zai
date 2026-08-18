use super::events::{CurrencyStateEvent, CurrencyStateEventBus};
use super::models::{CurrencyJobStatus, CurrencyJobType};
use super::service::{CurrencyService, CurrencySettingsPort, CurrencySetupState};
use crate::features::currency::models::{CurrencyJob, CurrencyJobRecord, PersistedCurrency};
use crate::{Error, ErrorCode, Result};
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct MemorySettings {
    default_currency: String,
    setup_completed: bool,
    persisted: Vec<PersistedCurrency>,
    jobs: Vec<CurrencyJob>,
}

impl MemorySettings {
    fn new() -> Self {
        Self {
            default_currency: "EUR".to_string(),
            setup_completed: false,
            persisted: vec![PersistedCurrency {
                code: "EUR".to_string(),
                disabled: false,
                used_by_recurring: false,
            }],
            jobs: Vec::new(),
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
            inner.persisted.push(PersistedCurrency {
                code: currency_code.to_string(),
                disabled: false,
                used_by_recurring: false,
            });
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
        Ok(self
            .lock()
            .expect("lock")
            .jobs
            .iter()
            .find(|job| job.job_id == job_id)
            .cloned()
            .map(|job| CurrencyJobRecord { job }))
    }

    fn running_job(&self) -> Result<Option<CurrencyJobRecord>> {
        Ok(self
            .lock()
            .expect("lock")
            .jobs
            .iter()
            .find(|job| job.status == CurrencyJobStatus::Running)
            .cloned()
            .map(|job| CurrencyJobRecord { job }))
    }

    fn latest_job(&self) -> Result<Option<CurrencyJobRecord>> {
        Ok(self
            .lock()
            .expect("lock")
            .jobs
            .last()
            .cloned()
            .map(|job| CurrencyJobRecord { job }))
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
