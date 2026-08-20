use crate::ErrorEnvelope;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencyBootstrap {
    pub setup_complete: bool,
    pub default_currency: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportedCurrency {
    pub code: String,
    pub name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CurrencyLifecycleStatus {
    Enabled,
    Adding,
    Disabled,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CurrencyRefreshStatus {
    Fresh,
    Stale,
    Failed,
    Idle,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencySettingsRow {
    pub code: String,
    pub name: String,
    pub status: CurrencyLifecycleStatus,
    pub coverage_from: Option<String>,
    pub coverage_to: Option<String>,
    pub last_refresh: Option<String>,
    pub refresh_status: CurrencyRefreshStatus,
    pub missing_periods: Vec<String>,
    pub used_by_recurring: bool,
    pub is_default: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CurrencyJobType {
    Setup,
    AddCurrency,
    ChangeDefault,
    ImportPreview,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CurrencyJobStatus {
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CurrencyJobFinishState {
    Succeeded,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencyJob {
    pub job_id: String,
    #[serde(rename = "type")]
    pub job_type: CurrencyJobType,
    pub status: CurrencyJobStatus,
    pub stage_current: u32,
    pub stage_total: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorEnvelope>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencyStatusView {
    pub job: Option<CurrencyJob>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PersistedCurrency {
    pub code: String,
    pub disabled: bool,
    pub used_by_recurring: bool,
    pub coverage_from: Option<String>,
    pub coverage_to: Option<String>,
    pub last_refresh: Option<String>,
    pub refresh_status: CurrencyRefreshStatus,
    pub missing_periods: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CurrencyJobRecord {
    pub job: CurrencyJob,
    pub generation_id: Option<String>,
}

impl CurrencyJob {
    pub fn setup(job_id: impl Into<String>, currency_code: &str) -> Self {
        Self::running(job_id, CurrencyJobType::Setup, currency_code, 1)
    }

    pub fn add_currency(job_id: impl Into<String>, currency_code: &str) -> Self {
        Self::running(job_id, CurrencyJobType::AddCurrency, currency_code, 2)
    }

    pub fn change_default(job_id: impl Into<String>, currency_code: &str) -> Self {
        Self::running(job_id, CurrencyJobType::ChangeDefault, currency_code, 2)
    }

    pub fn import_preview(job_id: impl Into<String>) -> Self {
        Self {
            job_id: job_id.into(),
            job_type: CurrencyJobType::ImportPreview,
            status: CurrencyJobStatus::Running,
            stage_current: 0,
            stage_total: 1,
            currency_code: None,
            error: None,
        }
    }

    fn running(
        job_id: impl Into<String>,
        job_type: CurrencyJobType,
        currency_code: &str,
        stage_total: u32,
    ) -> Self {
        Self {
            job_id: job_id.into(),
            job_type,
            status: CurrencyJobStatus::Running,
            stage_current: 0,
            stage_total,
            currency_code: Some(currency_code.to_string()),
            error: None,
        }
    }

    pub fn finish_succeeded(mut self) -> Self {
        self.status = CurrencyJobStatus::Succeeded;
        self.stage_current = self.stage_total;
        self.error = None;
        self
    }

    pub fn finish_failed(mut self, error: ErrorEnvelope) -> Self {
        self.status = CurrencyJobStatus::Failed;
        self.error = Some(error);
        self
    }

    pub fn finish_cancelled(mut self) -> Self {
        self.status = CurrencyJobStatus::Cancelled;
        self.error = None;
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeRateQuote {
    pub source_currency: String,
    pub target_currency: String,
    pub rate_date: String,
    pub variant: QuoteVariant,
    pub rate: Option<String>,
    pub attribution: Option<String>,
    pub complete: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum QuoteVariant {
    Identity,
    Automatic,
    Pending,
}
