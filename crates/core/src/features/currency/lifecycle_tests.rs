use super::models::{CurrencyJobStatus, CurrencyLifecycleStatus};
use super::service::{CurrencyService, CurrencySettingsPort, CurrencySetupState};
use crate::features::currency::events::CurrencyStateEventBus;
use crate::features::currency::models::{
    CurrencyJob, CurrencyJobRecord, CurrencyRefreshStatus, ExchangeRateQuote, PersistedCurrency,
    QuoteVariant,
};
use crate::{Error, ErrorCode, Result};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

// Re-implement a focused mock so these tests stay independent of setup fixtures.
struct MemorySettings {
    default_currency: String,
    setup_completed: bool,
    persisted: Vec<PersistedCurrency>,
    jobs: Vec<CurrencyJob>,
    disclosure_accepted: bool,
    coverage_ok: HashSet<String>,
    missing_periods: HashMap<String, Vec<String>>,
    generation_ids: HashMap<String, String>,
    activated_default: Option<String>,
    fail_activate: bool,
}

impl MemorySettings {
    fn setup_complete() -> Self {
        Self {
            default_currency: "EUR".to_string(),
            setup_completed: true,
            persisted: vec![row("EUR", false)],
            jobs: Vec::new(),
            disclosure_accepted: false,
            coverage_ok: HashSet::from(["EUR".to_string()]),
            missing_periods: HashMap::new(),
            generation_ids: HashMap::new(),
            activated_default: None,
            fail_activate: false,
        }
    }
}

fn row(code: &str, disabled: bool) -> PersistedCurrency {
    PersistedCurrency {
        code: code.to_string(),
        disabled,
        used_by_recurring: false,
        coverage_from: None,
        coverage_to: None,
        last_refresh: None,
        refresh_status: CurrencyRefreshStatus::Idle,
        missing_periods: Vec::new(),
    }
}

impl CurrencySettingsPort for Mutex<MemorySettings> {
    fn complete_initial_setup(&self, currency_code: &str) -> Result<()> {
        let mut inner = self.lock().expect("lock");
        inner.default_currency = currency_code.to_string();
        inner.setup_completed = true;
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
        record_for(&self.lock().expect("lock"), |job| job.job_id == job_id)
    }

    fn running_job(&self) -> Result<Option<CurrencyJobRecord>> {
        record_for(&self.lock().expect("lock"), |job| {
            job.status == CurrencyJobStatus::Running
        })
    }

    fn latest_job(&self) -> Result<Option<CurrencyJobRecord>> {
        let inner = self.lock().expect("lock");
        Ok(inner.jobs.last().cloned().map(|job| CurrencyJobRecord {
            generation_id: inner.generation_ids.get(&job.job_id).cloned(),
            job,
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
            inner.persisted.push(row(currency_code, false));
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
            Ok(())
        } else {
            Err(Error::IncompleteCoverage {
                missing_periods: vec!["historical coverage".to_string()],
            })
        }
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
        Ok(format!("gen-{currency_code}"))
    }

    fn activate_default_generation(&self, _generation_id: &str, currency_code: &str) -> Result<()> {
        let mut inner = self.lock().expect("lock");
        if inner.fail_activate {
            inner.fail_activate = false;
            return Err(Error::InvalidData(
                "injected default-generation activation failure".to_string(),
            ));
        }
        inner.default_currency = currency_code.to_string();
        inner.activated_default = Some(currency_code.to_string());
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
        let complete = self.lock().expect("lock").coverage_ok.contains(source);
        Ok(ExchangeRateQuote {
            source_currency: source.to_string(),
            target_currency: target.to_string(),
            rate_date: rate_date.to_string(),
            variant: if complete {
                QuoteVariant::Automatic
            } else {
                QuoteVariant::Pending
            },
            rate: complete.then(|| "1.1".to_string()),
            attribution: complete.then(|| "European Central Bank".to_string()),
            complete,
        })
    }
}

fn record_for(
    inner: &MemorySettings,
    predicate: impl Fn(&CurrencyJob) -> bool,
) -> Result<Option<CurrencyJobRecord>> {
    Ok(inner
        .jobs
        .iter()
        .find(|job| predicate(job))
        .cloned()
        .map(|job| CurrencyJobRecord {
            generation_id: inner.generation_ids.get(&job.job_id).cloned(),
            job,
        }))
}

fn service_from(settings: MemorySettings) -> (CurrencyService, Arc<Mutex<MemorySettings>>) {
    let settings = Arc::new(Mutex::new(settings));
    let bus = CurrencyStateEventBus::new();
    (CurrencyService::new(settings.clone(), bus), settings)
}

#[test]
fn addition_without_disclosure_is_refused() {
    let (service, settings) = service_from(MemorySettings::setup_complete());
    let error = service
        .start_currency_addition("USD", false)
        .expect_err("disclosure required");
    assert_eq!(error.code(), ErrorCode::ProviderDisclosureRequired);
    assert!(settings.lock().expect("lock").jobs.is_empty());
}

#[test]
fn addition_marks_adding_until_drive_commits() {
    let mut memory = MemorySettings::setup_complete();
    memory.coverage_ok.insert("USD".to_string());
    let (service, _) = service_from(memory);
    let job = service
        .start_currency_addition("USD", true)
        .expect("start add");
    assert_eq!(job.status, CurrencyJobStatus::Running);
    let rows = service.list_settings().expect("settings");
    let usd = rows.iter().find(|row| row.code == "USD").expect("usd row");
    assert_eq!(usd.status, CurrencyLifecycleStatus::Adding);
    assert!(!usd.is_default);

    let finished = service.drive_running_job().expect("drive");
    assert_eq!(finished.status, CurrencyJobStatus::Succeeded);
    let rows = service.list_settings().expect("settings");
    let usd = rows.iter().find(|row| row.code == "USD").expect("usd row");
    assert_eq!(usd.status, CurrencyLifecycleStatus::Enabled);
}

#[test]
fn incomplete_coverage_fails_without_enablement() {
    let mut memory = MemorySettings::setup_complete();
    memory
        .missing_periods
        .insert("USD".to_string(), vec!["2024-01-02".to_string()]);
    let (service, settings) = service_from(memory);
    service
        .start_currency_addition("USD", true)
        .expect("start add");
    let error = service.drive_running_job().expect_err("incomplete");
    assert_eq!(error.code(), ErrorCode::IncompleteCoverage);
    assert!(
        !settings
            .lock()
            .expect("lock")
            .persisted
            .iter()
            .any(|row| row.code == "USD")
    );
}

#[test]
fn default_currency_cannot_be_disabled() {
    let (service, _) = service_from(MemorySettings::setup_complete());
    let error = service.disable_currency("EUR").expect_err("forbidden");
    assert_eq!(error.code(), ErrorCode::DefaultCurrencyDisableForbidden);
}

#[test]
fn disable_is_reversible_and_keeps_the_row() {
    let mut memory = MemorySettings::setup_complete();
    memory.persisted.push(row("USD", false));
    memory.coverage_ok.insert("USD".to_string());
    let (service, _) = service_from(memory);
    let disabled = service.disable_currency("USD").expect("disable");
    assert_eq!(disabled.status, CurrencyLifecycleStatus::Disabled);
    service
        .start_currency_addition("USD", true)
        .expect("re-enable start");
    service.drive_running_job().expect("re-enable");
    let usd = service.get_currency("USD").expect("usd");
    assert_eq!(usd.status, CurrencyLifecycleStatus::Enabled);
}

#[test]
fn second_job_conflicts() {
    let mut memory = MemorySettings::setup_complete();
    memory.coverage_ok.insert("USD".to_string());
    memory.persisted.push(row("USD", false));
    let (service, _) = service_from(memory);
    service
        .start_currency_addition("USD", true)
        .expect("add job");
    let error = service
        .start_default_currency_change("USD")
        .expect_err("conflict");
    assert_eq!(error.code(), ErrorCode::CurrencyJobConflict);
}

#[test]
fn default_change_keeps_old_default_until_activation() {
    let mut memory = MemorySettings::setup_complete();
    memory.persisted.push(row("USD", false));
    let (service, settings) = service_from(memory);
    let job = service
        .start_default_currency_change("USD")
        .expect("start change");
    assert_eq!(job.status, CurrencyJobStatus::Running);
    assert_eq!(
        service
            .bootstrap()
            .expect("bootstrap")
            .default_currency
            .as_deref(),
        Some("EUR")
    );
    service.drive_running_job().expect("drive");
    assert_eq!(
        service
            .bootstrap()
            .expect("bootstrap")
            .default_currency
            .as_deref(),
        Some("USD")
    );
    assert_eq!(
        settings.lock().expect("lock").activated_default.as_deref(),
        Some("USD")
    );
}

#[test]
fn cancel_before_activation_leaves_previous_default() {
    let mut memory = MemorySettings::setup_complete();
    memory.persisted.push(row("USD", false));
    let (service, _) = service_from(memory);
    let job = service
        .start_default_currency_change("USD")
        .expect("start change");
    let cancelled = service.cancel_currency_job(&job.job_id).expect("cancel");
    assert_eq!(cancelled.status, CurrencyJobStatus::Cancelled);
    assert_eq!(
        service
            .bootstrap()
            .expect("bootstrap")
            .default_currency
            .as_deref(),
        Some("EUR")
    );
}

#[test]
fn fail_before_activation_leaves_previous_default() {
    let mut memory = MemorySettings::setup_complete();
    memory.persisted.push(row("USD", false));
    memory.fail_activate = true;
    let (service, settings) = service_from(memory);
    let job = service
        .start_default_currency_change("USD")
        .expect("start change");
    service
        .drive_running_job()
        .expect_err("activation should fail");
    assert_eq!(
        service
            .bootstrap()
            .expect("bootstrap")
            .default_currency
            .as_deref(),
        Some("EUR")
    );
    assert!(
        settings
            .lock()
            .expect("lock")
            .generation_ids
            .contains_key(&job.job_id)
    );
}

#[test]
fn restart_after_failed_activation_changes_default() {
    let mut memory = MemorySettings::setup_complete();
    memory.persisted.push(row("USD", false));
    memory.fail_activate = true;
    let (service, _) = service_from(memory);
    service
        .start_default_currency_change("USD")
        .expect("start change");
    service
        .drive_running_job()
        .expect_err("first drive fails before activation");
    assert_eq!(
        service
            .bootstrap()
            .expect("bootstrap")
            .default_currency
            .as_deref(),
        Some("EUR")
    );

    let restarted = service
        .start_default_currency_change("USD")
        .expect("restart change");
    assert_eq!(restarted.status, CurrencyJobStatus::Running);
    service.drive_running_job().expect("retry drive");
    assert_eq!(
        service
            .bootstrap()
            .expect("bootstrap")
            .default_currency
            .as_deref(),
        Some("USD")
    );
}

#[test]
fn same_currency_quote_is_identity() {
    let (service, _) = service_from(MemorySettings::setup_complete());
    let quote = service.quote("EUR", "EUR", "2026-08-18").expect("quote");
    assert_eq!(quote.variant, QuoteVariant::Identity);
    assert!(quote.complete);
}
