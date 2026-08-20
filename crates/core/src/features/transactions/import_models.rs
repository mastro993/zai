use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

use super::models::{NewTransaction, RateOrigin, RateVariant, Transaction};
use crate::Result;
use crate::features::currency::CurrencyJob;
use crate::features::transaction_categories::models::NewTransactionCategory;
use crate::money::CanonicalRate;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RateDirection {
    TransactionToDefault,
    DefaultToTransaction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CurrencyPrepAction {
    AlreadyEnabled,
    Add,
    ReEnable,
    Backfill,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportPreviewRowStatus {
    Import,
    Duplicate,
    Invalid,
    Empty,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MappedExternalRate {
    pub rate: String,
    pub direction: RateDirection,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rate_date: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeRateFields {
    pub export_version: u32,
    pub rate_variant: RateVariant,
    pub rate_state: String,
    pub rate_date: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_observation_date: Option<String>,
    pub source_currency: String,
    pub reference_currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub coefficient: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scale: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub original_decimal: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub formula_version: Option<u32>,
    pub origin: RateOrigin,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MappedImportRow {
    pub row_number: i32,
    #[serde(default)]
    pub empty: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount_minor: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transaction_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mapped_rate: Option<MappedExternalRate>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native: Option<NativeRateFields>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewTransactionImportRequest {
    pub file_digest: String,
    pub has_currency_column: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confirmed_transaction_currency: Option<String>,
    #[serde(default)]
    pub confirm_provider_disclosure: bool,
    pub rows: Vec<MappedImportRow>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreviewBinding {
    pub file_digest: String,
    pub default_currency_revision: i32,
    pub manifest_version: String,
    pub coverage_proof: String,
}

impl ImportPreviewBinding {
    pub fn matches(&self, other: &Self) -> bool {
        self == other
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreviewRowResult {
    pub row_number: i32,
    pub status: ImportPreviewRowStatus,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transaction_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount_minor: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transaction_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rate_origin: Option<RateOrigin>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencyPreparation {
    pub code: String,
    pub name: String,
    pub action: CurrencyPrepAction,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub coverage_from: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub coverage_to: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreviewSummary {
    pub total_rows: i32,
    pub importable_rows: i32,
    pub duplicate_rows: i32,
    pub invalid_rows: i32,
    pub empty_rows: i32,
    pub categories_to_create: i32,
    pub blocked: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundImportPreview {
    pub token: String,
    pub job: CurrencyJob,
    pub binding: ImportPreviewBinding,
    pub rows: Vec<ImportPreviewRowResult>,
    pub currency_preparations: Vec<CurrencyPreparation>,
    pub summary: ImportPreviewSummary,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitTransactionImportRequest {
    pub token: String,
    pub file_digest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitTransactionImportResponse {
    pub transactions: Vec<Transaction>,
}

#[derive(Debug, Clone)]
pub enum ImportRatePlan {
    Lookup,
    Manual {
        decimal: String,
        rate_date: Option<NaiveDateTime>,
    },
    Identity,
    Pending {
        rate_date: NaiveDateTime,
    },
    Automatic {
        decimal: String,
        rate_date: NaiveDateTime,
        formula_version: u32,
    },
}

#[derive(Debug, Clone)]
pub struct BoundImportCommitRow {
    pub transaction: NewTransaction,
    pub rate_plan: ImportRatePlan,
}

#[derive(Debug, Clone)]
pub struct BoundImportCommitRequest {
    pub enable_currencies: Vec<String>,
    pub categories: Vec<NewTransactionCategory>,
    pub rows: Vec<BoundImportCommitRow>,
}

pub fn resolve_mapped_rate_decimal(mapped: &MappedExternalRate) -> Result<String> {
    let parsed = CanonicalRate::parse(&mapped.rate)?;
    let decimal = match mapped.direction {
        RateDirection::TransactionToDefault => parsed.original_decimal().to_string(),
        RateDirection::DefaultToTransaction => parsed.inverse()?.original_decimal().to_string(),
    };
    Ok(decimal)
}
