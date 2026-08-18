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
}

#[derive(Debug, Clone, PartialEq)]
pub struct CurrencyJobRecord {
    pub job: CurrencyJob,
}

impl CurrencyJob {
    pub fn setup(job_id: impl Into<String>, currency_code: &str) -> Self {
        Self {
            job_id: job_id.into(),
            job_type: CurrencyJobType::Setup,
            status: CurrencyJobStatus::Running,
            stage_current: 0,
            stage_total: 1,
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
}
