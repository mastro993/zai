use super::events::CurrencyStateEvent;
use super::models::{
    CurrencyJob, CurrencyJobFinishState, CurrencyJobRecord, CurrencyJobStatus, CurrencyJobType,
    CurrencySettingsRow, ExchangeRateQuote,
};
use super::service::{CurrencyService, needs_provider, require_supported};
use crate::{Error, Result};
use uuid::Uuid;

impl CurrencyService {
    pub fn start_currency_addition(
        &self,
        currency_code: &str,
        confirm_provider_disclosure: bool,
    ) -> Result<CurrencyJob> {
        self.settings.require_setup()?;
        let currency = require_supported(currency_code)?;
        let code = currency.as_str();
        if needs_provider(code)
            && !self.settings.provider_disclosure_accepted()?
            && !confirm_provider_disclosure
        {
            return Err(Error::ProviderDisclosureRequired);
        }
        if let Some(running) = self.settings.running_job()? {
            let same_add = running.job.job_type == CurrencyJobType::AddCurrency
                && running.job.currency_code.as_deref() == Some(code);
            if same_add {
                return Ok(running.job);
            }
            return Err(Error::CurrencyJobConflict);
        }

        if confirm_provider_disclosure && needs_provider(code) {
            self.settings.accept_provider_disclosure()?;
        }

        let job = CurrencyJob::add_currency(format!("curjob-{}", Uuid::new_v4()), code);
        self.settings.insert_job(&job)?;
        self.publish(&CurrencyStateEvent::Started {
            job_id: job.job_id.clone(),
            job_type: CurrencyJobType::AddCurrency,
        });
        Ok(job)
    }

    pub fn disable_currency(&self, currency_code: &str) -> Result<CurrencySettingsRow> {
        self.settings.require_setup()?;
        let currency = require_supported(currency_code)?;
        let code = currency.as_str();
        let state = self.settings.setup_state()?;
        if state.default_currency == code {
            return Err(Error::DefaultCurrencyDisableForbidden);
        }
        let persisted = self
            .settings
            .list_persisted()?
            .into_iter()
            .find(|row| row.code == code)
            .ok_or_else(|| Error::NotFound(format!("Currency {code}")))?;
        if persisted.disabled {
            return self.get_currency(code);
        }
        self.settings.disable_currency(code)?;
        self.publish(&CurrencyStateEvent::StateChanged);
        self.get_currency(code)
    }

    pub fn start_default_currency_change(&self, currency_code: &str) -> Result<CurrencyJob> {
        self.settings.require_setup()?;
        let currency = require_supported(currency_code)?;
        let code = currency.as_str();
        let state = self.settings.setup_state()?;
        if state.default_currency == code {
            let mut job = CurrencyJob::change_default(format!("curjob-{}", Uuid::new_v4()), code);
            job = job.finish_succeeded();
            return Ok(job);
        }
        let enabled = self
            .settings
            .list_persisted()?
            .into_iter()
            .any(|row| row.code == code && !row.disabled);
        if !enabled {
            return Err(Error::CurrencyNotEnabled(code.to_string()));
        }
        if let Some(running) = self.settings.running_job()? {
            let same = running.job.job_type == CurrencyJobType::ChangeDefault
                && running.job.currency_code.as_deref() == Some(code);
            if same {
                return Ok(running.job);
            }
            return Err(Error::CurrencyJobConflict);
        }

        let job = CurrencyJob::change_default(format!("curjob-{}", Uuid::new_v4()), code);
        self.settings.insert_job(&job)?;
        self.publish(&CurrencyStateEvent::Started {
            job_id: job.job_id.clone(),
            job_type: CurrencyJobType::ChangeDefault,
        });
        Ok(job)
    }

    pub fn cancel_currency_job(&self, job_id: &str) -> Result<CurrencyJob> {
        let record = self
            .settings
            .get_job(job_id)?
            .ok_or_else(|| Error::CurrencyJobNotFound(job_id.to_string()))?;
        if record.job.status != CurrencyJobStatus::Running {
            return Ok(record.job);
        }
        let finished = record.job.finish_cancelled();
        self.settings.update_job(&finished)?;
        self.publish_finished(&finished, CurrencyJobFinishState::Cancelled);
        Ok(finished)
    }

    pub fn drive_running_job(&self) -> Result<CurrencyJob> {
        let Some(record) = self.settings.running_job()? else {
            return Err(Error::CurrencyJobNotFound("running".to_string()));
        };
        match record.job.job_type {
            CurrencyJobType::AddCurrency => self.drive_add(record.job),
            CurrencyJobType::ChangeDefault => self.drive_change_default(record),
            CurrencyJobType::Setup => {
                let code =
                    record.job.currency_code.clone().ok_or_else(|| {
                        Error::InvalidData("Setup job missing currency".to_string())
                    })?;
                self.run_setup_job(record.job, &code)
            }
            CurrencyJobType::ImportPreview => Err(Error::InvalidData(
                "Import preview jobs are not driven here".to_string(),
            )),
        }
    }

    pub fn has_ecb_retained_data(&self) -> Result<bool> {
        self.settings.has_ecb_retained_data()
    }

    pub fn quote(&self, source: &str, target: &str, rate_date: &str) -> Result<ExchangeRateQuote> {
        self.settings.require_setup()?;
        let source = require_supported(source)?;
        let target = require_supported(target)?;
        self.settings
            .quote(source.as_str(), target.as_str(), rate_date)
    }

    fn drive_add(&self, mut job: CurrencyJob) -> Result<CurrencyJob> {
        let code = job
            .currency_code
            .clone()
            .ok_or_else(|| Error::InvalidData("Add job missing currency".to_string()))?;
        job.stage_current = 1;
        self.settings.update_job(&job)?;
        self.publish(&CurrencyStateEvent::Progress {
            job_id: job.job_id.clone(),
            job_type: CurrencyJobType::AddCurrency,
            stage_current: job.stage_current,
            stage_total: job.stage_total,
        });
        if self.job_cancelled(&job.job_id)? {
            return self.get_job(&job.job_id);
        }
        match self.settings.prove_coverage(&code) {
            Ok(()) => {}
            Err(error) => return self.fail_job(job, error),
        }
        if self.job_cancelled(&job.job_id)? {
            return self.get_job(&job.job_id);
        }
        match self.settings.enable_currency(&code) {
            Ok(()) => self.mark_job_succeeded(job),
            Err(error) => self.fail_job(job, error),
        }
    }

    fn drive_change_default(&self, record: CurrencyJobRecord) -> Result<CurrencyJob> {
        let mut job = record.job;
        let code = job
            .currency_code
            .clone()
            .ok_or_else(|| Error::InvalidData("Default-change job missing currency".to_string()))?;
        job.stage_current = 1;
        self.settings.update_job(&job)?;
        self.publish(&CurrencyStateEvent::Progress {
            job_id: job.job_id.clone(),
            job_type: CurrencyJobType::ChangeDefault,
            stage_current: job.stage_current,
            stage_total: job.stage_total,
        });
        if self.job_cancelled(&job.job_id)? {
            return self.get_job(&job.job_id);
        }
        let generation_id = match record.generation_id {
            Some(id) => id,
            None => match self.settings.begin_default_generation(&code) {
                Ok(id) => {
                    self.settings.attach_generation(&job.job_id, &id)?;
                    id
                }
                Err(error) => return self.fail_job(job, error),
            },
        };
        if self.job_cancelled(&job.job_id)? {
            return self.get_job(&job.job_id);
        }
        match self
            .settings
            .activate_default_generation(&generation_id, &code)
        {
            Ok(()) => self.mark_job_succeeded(job),
            Err(error) => self.fail_job(job, error),
        }
    }

    fn fail_job(&self, job: CurrencyJob, error: Error) -> Result<CurrencyJob> {
        let finished = job.finish_failed(super::service::job_error_envelope(&error));
        self.settings.update_job(&finished)?;
        self.publish_finished(&finished, CurrencyJobFinishState::Failed);
        Err(error)
    }

    fn job_cancelled(&self, job_id: &str) -> Result<bool> {
        Ok(self
            .settings
            .get_job(job_id)?
            .is_some_and(|record| record.job.status == CurrencyJobStatus::Cancelled))
    }
}
