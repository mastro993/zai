use std::collections::{HashMap, HashSet};

use chrono::NaiveDateTime;

use super::dedup::duplicate_key;
use super::export_csv::{TRANSACTION_EXPORT_VERSION, UPGRADE_EXPORT_MESSAGE, parse_export_version};
use super::import_models::{
    BoundImportCommitRequest, BoundImportCommitRow, CurrencyPrepAction, CurrencyPreparation,
    ImportPreviewBinding, ImportPreviewRowResult, ImportPreviewRowStatus, ImportPreviewSummary,
    ImportRatePlan, MappedImportRow, NativeRateFields, PreviewTransactionImportRequest,
};
use super::models::{DuplicateKeyCandidate, NewTransaction, RateOrigin, RateVariant};
use crate::features::currency::{PersistedCurrency, needs_provider};
use crate::features::transaction_categories::models::NewTransactionCategory;
use crate::money::{CONVERSION_FORMULA_VERSION, CURRENT_MANIFEST, CurrencyCode, MANIFEST_VERSION};
use crate::{Error, Result};

#[derive(Debug, Clone)]
pub struct ClassifiedImport {
    pub rows: Vec<ImportPreviewRowResult>,
    pub summary: ImportPreviewSummary,
    pub currencies: Vec<String>,
    pub commit: BoundImportCommitRequest,
}

pub struct CurrencyPrepContext<'a> {
    pub persisted: &'a [PersistedCurrency],
    pub default_currency: &'a str,
}

pub fn require_currencyless_confirmation(request: &PreviewTransactionImportRequest) -> Result<()> {
    if request.has_currency_column {
        return Ok(());
    }
    match request
        .confirmed_transaction_currency
        .as_deref()
        .map(str::trim)
    {
        Some(code) if !code.is_empty() => {
            CurrencyCode::parse(code)?;
            Ok(())
        }
        _ => Err(Error::InvalidData(
            "Confirm one transaction currency for this currencyless file".to_string(),
        )),
    }
}

pub fn classify_import(
    request: &PreviewTransactionImportRequest,
    existing_duplicate_keys: &HashSet<String>,
) -> Result<ClassifiedImport> {
    require_currencyless_confirmation(request)?;
    let confirmed = request
        .confirmed_transaction_currency
        .as_deref()
        .map(str::trim)
        .filter(|code| !code.is_empty())
        .map(|code| code.to_ascii_uppercase());

    let mut preview_rows = Vec::with_capacity(request.rows.len());
    let mut commit_rows = Vec::new();
    let mut categories: Vec<NewTransactionCategory> = Vec::new();
    let mut category_ids: HashMap<String, String> = HashMap::new();
    let mut imported_keys = HashSet::new();
    let mut currencies = Vec::new();

    for mapped in &request.rows {
        if let Some(native) = mapped.native.as_ref() {
            parse_export_version(&native.export_version.to_string())?;
            if native.export_version > TRANSACTION_EXPORT_VERSION {
                return Err(Error::InvalidData(UPGRADE_EXPORT_MESSAGE.to_string()));
            }
        }

        if mapped.empty {
            preview_rows.push(empty_row(mapped.row_number));
            continue;
        }

        match classify_row(
            mapped,
            request.has_currency_column,
            confirmed.as_deref(),
            existing_duplicate_keys,
            &mut imported_keys,
            &mut category_ids,
            &mut categories,
        ) {
            Ok(ClassifiedRow::Skip(result)) => preview_rows.push(result),
            Ok(ClassifiedRow::Import {
                result,
                commit,
                currency,
            }) => {
                if !currencies.iter().any(|code| code == &currency) {
                    currencies.push(currency);
                }
                preview_rows.push(result);
                commit_rows.push(*commit);
            }
            Err(result) => preview_rows.push(*result),
        }
    }

    let invalid_rows = count_status(&preview_rows, ImportPreviewRowStatus::Invalid);
    let summary = ImportPreviewSummary {
        total_rows: i32::try_from(preview_rows.len()).unwrap_or(i32::MAX),
        importable_rows: count_status(&preview_rows, ImportPreviewRowStatus::Import),
        duplicate_rows: count_status(&preview_rows, ImportPreviewRowStatus::Duplicate),
        invalid_rows,
        empty_rows: count_status(&preview_rows, ImportPreviewRowStatus::Empty),
        categories_to_create: i32::try_from(categories.len()).unwrap_or(i32::MAX),
        blocked: invalid_rows > 0,
    };

    Ok(ClassifiedImport {
        rows: preview_rows,
        summary,
        currencies,
        commit: BoundImportCommitRequest {
            enable_currencies: Vec::new(),
            categories,
            rows: commit_rows,
        },
    })
}

pub fn currency_preparations(
    currencies: &[String],
    context: CurrencyPrepContext<'_>,
) -> Vec<CurrencyPreparation> {
    currencies
        .iter()
        .map(|code| {
            let persisted = context.persisted.iter().find(|row| row.code == *code);
            let action = match persisted {
                None => CurrencyPrepAction::Add,
                Some(row) if row.disabled => CurrencyPrepAction::ReEnable,
                Some(row) if needs_backfill(row) => CurrencyPrepAction::Backfill,
                Some(_) => CurrencyPrepAction::AlreadyEnabled,
            };
            let name = CURRENT_MANIFEST
                .get(code)
                .map(|record| record.name.to_string())
                .unwrap_or_else(|| code.clone());
            CurrencyPreparation {
                coverage_from: persisted.and_then(|row| row.coverage_from.clone()),
                coverage_to: persisted.and_then(|row| row.coverage_to.clone()),
                code: code.clone(),
                name,
                action,
            }
        })
        .collect()
}

pub fn currencies_needing_provider(preparations: &[CurrencyPreparation]) -> Vec<String> {
    preparations
        .iter()
        .filter(|prep| {
            !matches!(prep.action, CurrencyPrepAction::AlreadyEnabled) && needs_provider(&prep.code)
        })
        .map(|prep| prep.code.clone())
        .collect()
}

pub fn currencies_to_enable(preparations: &[CurrencyPreparation]) -> Vec<String> {
    preparations
        .iter()
        .filter(|prep| !matches!(prep.action, CurrencyPrepAction::AlreadyEnabled))
        .map(|prep| prep.code.clone())
        .collect()
}

pub fn binding_for(
    file_digest: &str,
    default_currency_revision: i32,
    coverage_proof: &str,
) -> ImportPreviewBinding {
    ImportPreviewBinding {
        file_digest: file_digest.to_string(),
        default_currency_revision,
        manifest_version: MANIFEST_VERSION.to_string(),
        coverage_proof: coverage_proof.to_string(),
    }
}

enum ClassifiedRow {
    Skip(ImportPreviewRowResult),
    Import {
        result: ImportPreviewRowResult,
        commit: Box<BoundImportCommitRow>,
        currency: String,
    },
}

type ClassifyError = Box<ImportPreviewRowResult>;

fn classify_row(
    mapped: &MappedImportRow,
    has_currency_column: bool,
    confirmed: Option<&str>,
    existing_duplicate_keys: &HashSet<String>,
    imported_keys: &mut HashSet<String>,
    category_ids: &mut HashMap<String, String>,
    categories: &mut Vec<NewTransactionCategory>,
) -> std::result::Result<ClassifiedRow, ClassifyError> {
    let date = parse_required_date(mapped)?;
    let amount = mapped
        .amount_minor
        .ok_or_else(|| invalid_row(mapped, "Amount is required"))?;
    if amount < 0 {
        return Err(invalid_row(mapped, "Transaction amount cannot be negative"));
    }
    let currency = resolve_currency(mapped, has_currency_column, confirmed)?;
    let transaction_type = mapped
        .transaction_type
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| invalid_row(mapped, "Transaction type is required"))?;
    if transaction_type != "expense" && transaction_type != "income" {
        return Err(invalid_row(
            mapped,
            &format!("Invalid transaction type: {transaction_type}"),
        ));
    }
    let rate_plan = resolve_rate_plan(mapped, date)?;
    let description = mapped
        .description
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let notes = mapped
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let key = duplicate_key(date, amount, &currency, description);
    if existing_duplicate_keys.contains(&key) || !imported_keys.insert(key) {
        return Ok(ClassifiedRow::Skip(ImportPreviewRowResult {
            row_number: mapped.row_number,
            status: ImportPreviewRowStatus::Duplicate,
            message: "Duplicate transaction skipped".to_string(),
            transaction_date: Some(format_date(date)),
            amount_minor: Some(amount),
            currency: Some(currency),
            transaction_type: Some(transaction_type.to_string()),
            description: description.map(ToOwned::to_owned),
            notes: notes.map(ToOwned::to_owned),
            category: display_category(mapped),
            rate_origin: rate_origin(&rate_plan),
        }));
    }

    let category_id = resolve_category_id(mapped, category_ids, categories)?;
    let transaction = NewTransaction {
        id: Some(format!("imp-{}", mapped.row_number)),
        description: description.map(ToOwned::to_owned),
        amount,
        currency: currency.clone(),
        transaction_date: date,
        transaction_type: transaction_type.to_string(),
        transaction_category_id: category_id,
        notes: notes.map(ToOwned::to_owned),
        manual_exchange_rate: match &rate_plan {
            ImportRatePlan::Manual { decimal, .. } => Some(decimal.clone()),
            _ => None,
        },
    };
    transaction
        .validate()
        .map_err(|error| invalid_row(mapped, &error.to_string()))?;

    Ok(ClassifiedRow::Import {
        result: ImportPreviewRowResult {
            row_number: mapped.row_number,
            status: ImportPreviewRowStatus::Import,
            message: "Ready to import".to_string(),
            transaction_date: Some(format_date(date)),
            amount_minor: Some(amount),
            currency: Some(currency.clone()),
            transaction_type: Some(transaction_type.to_string()),
            description: description.map(ToOwned::to_owned),
            notes: notes.map(ToOwned::to_owned),
            category: display_category(mapped),
            rate_origin: rate_origin(&rate_plan),
        },
        commit: Box::new(BoundImportCommitRow {
            transaction,
            rate_plan,
        }),
        currency,
    })
}

fn resolve_currency(
    mapped: &MappedImportRow,
    has_currency_column: bool,
    confirmed: Option<&str>,
) -> std::result::Result<String, ClassifyError> {
    if has_currency_column {
        let raw = mapped
            .currency
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| invalid_row(mapped, "Currency is required"))?;
        return CurrencyCode::parse(raw)
            .map(|code| code.as_str().to_string())
            .map_err(|_| invalid_row(mapped, "Invalid currency"));
    }
    confirmed
        .map(ToOwned::to_owned)
        .ok_or_else(|| invalid_row(mapped, "Confirm one transaction currency for this file"))
}

fn resolve_rate_plan(
    mapped: &MappedImportRow,
    transaction_date: NaiveDateTime,
) -> std::result::Result<ImportRatePlan, ClassifyError> {
    if let Some(native) = mapped.native.as_ref() {
        return native_rate_plan(mapped, native, transaction_date);
    }
    if let Some(mapped_rate) = mapped.mapped_rate.as_ref() {
        let decimal = super::import_models::resolve_mapped_rate_decimal(mapped_rate)
            .map_err(|error| invalid_row(mapped, &error.to_string()))?;
        let rate_date = mapped_rate
            .rate_date
            .as_deref()
            .map(|value| parse_date_only(value).or_else(|_| parse_datetime(value)))
            .transpose()
            .map_err(|_| invalid_row(mapped, "Invalid mapped rate date"))?;
        return Ok(ImportRatePlan::Manual { decimal, rate_date });
    }
    Ok(ImportRatePlan::Lookup)
}

fn native_rate_plan(
    mapped: &MappedImportRow,
    native: &NativeRateFields,
    transaction_date: NaiveDateTime,
) -> std::result::Result<ImportRatePlan, ClassifyError> {
    if native.export_version > TRANSACTION_EXPORT_VERSION {
        return Err(invalid_row(mapped, UPGRADE_EXPORT_MESSAGE));
    }
    let rate_date = parse_date_only(&native.rate_date)
        .or_else(|_| parse_datetime(&native.rate_date))
        .unwrap_or(transaction_date);
    match native.rate_variant {
        RateVariant::Identity => Ok(ImportRatePlan::Identity),
        RateVariant::Pending => Ok(ImportRatePlan::Pending { rate_date }),
        RateVariant::Manual => {
            let decimal = native
                .original_decimal
                .clone()
                .ok_or_else(|| invalid_row(mapped, "Manual rate is missing its decimal"))?;
            Ok(ImportRatePlan::Manual {
                decimal,
                rate_date: Some(rate_date),
            })
        }
        RateVariant::Automatic => {
            if native.origin != RateOrigin::Supplied {
                return Err(invalid_row(
                    mapped,
                    "Automatic provenance requires supplied origin",
                ));
            }
            if native.formula_version.unwrap_or(CONVERSION_FORMULA_VERSION)
                != CONVERSION_FORMULA_VERSION
            {
                return Err(invalid_row(
                    mapped,
                    "Automatic rate formula version is not supported",
                ));
            }
            let decimal = native.original_decimal.clone().ok_or_else(|| {
                invalid_row(mapped, "Automatic rate is missing provider evidence")
            })?;
            Ok(ImportRatePlan::Automatic {
                decimal,
                rate_date,
                formula_version: native.formula_version.unwrap_or(CONVERSION_FORMULA_VERSION),
            })
        }
    }
}

fn resolve_category_id(
    mapped: &MappedImportRow,
    category_ids: &mut HashMap<String, String>,
    categories: &mut Vec<NewTransactionCategory>,
) -> std::result::Result<Option<String>, ClassifyError> {
    let name = mapped
        .category
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let parent = mapped
        .parent_category
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let Some(name) = name else {
        return Ok(None);
    };
    if let Some(parent_name) = parent {
        let parent_key = parent_name.to_ascii_lowercase();
        let parent_id = if let Some(id) = category_ids.get(&parent_key) {
            id.clone()
        } else {
            let id = format!("cat-{}", categories.len() + 1);
            category_ids.insert(parent_key, id.clone());
            categories.push(NewTransactionCategory {
                id: Some(id.clone()),
                parent_id: None,
                name: parent_name.to_string(),
                description: None,
                color: None,
                role: None,
            });
            id
        };
        let child_key = format!(
            "{}\u{0000}{}",
            parent_name.to_ascii_lowercase(),
            name.to_ascii_lowercase()
        );
        if let Some(id) = category_ids.get(&child_key) {
            return Ok(Some(id.clone()));
        }
        let id = format!("cat-{}", categories.len() + 1);
        category_ids.insert(child_key, id.clone());
        categories.push(NewTransactionCategory {
            id: Some(id.clone()),
            parent_id: Some(parent_id),
            name: name.to_string(),
            description: None,
            color: None,
            role: None,
        });
        return Ok(Some(id));
    }
    let key = name.to_ascii_lowercase();
    if let Some(id) = category_ids.get(&key) {
        return Ok(Some(id.clone()));
    }
    let id = format!("cat-{}", categories.len() + 1);
    category_ids.insert(key, id.clone());
    categories.push(NewTransactionCategory {
        id: Some(id.clone()),
        parent_id: None,
        name: name.to_string(),
        description: None,
        color: None,
        role: None,
    });
    Ok(Some(id))
}

fn parse_required_date(
    mapped: &MappedImportRow,
) -> std::result::Result<NaiveDateTime, ClassifyError> {
    let raw = mapped
        .date
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| invalid_row(mapped, "Date is required"))?;
    parse_datetime(raw)
        .or_else(|_| parse_date_only(raw))
        .map_err(|_| invalid_row(mapped, "Invalid date"))
}

fn parse_datetime(value: &str) -> std::result::Result<NaiveDateTime, ()> {
    NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S").map_err(|_| ())
}

fn parse_date_only(value: &str) -> std::result::Result<NaiveDateTime, ()> {
    chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| ())
        .and_then(|date| date.and_hms_opt(0, 0, 0).ok_or(()))
}

fn format_date(value: NaiveDateTime) -> String {
    value.format("%Y-%m-%dT%H:%M:%S").to_string()
}

fn empty_row(row_number: i32) -> ImportPreviewRowResult {
    ImportPreviewRowResult {
        row_number,
        status: ImportPreviewRowStatus::Empty,
        message: "Empty row skipped".to_string(),
        transaction_date: None,
        amount_minor: None,
        currency: None,
        transaction_type: None,
        description: None,
        notes: None,
        category: None,
        rate_origin: None,
    }
}

fn invalid_row(mapped: &MappedImportRow, message: &str) -> ClassifyError {
    Box::new(ImportPreviewRowResult {
        row_number: mapped.row_number,
        status: ImportPreviewRowStatus::Invalid,
        message: message.to_string(),
        transaction_date: mapped.date.clone(),
        amount_minor: mapped.amount_minor,
        currency: mapped.currency.clone(),
        transaction_type: mapped.transaction_type.clone(),
        description: mapped.description.clone(),
        notes: mapped.notes.clone(),
        category: display_category(mapped),
        rate_origin: None,
    })
}

fn display_category(mapped: &MappedImportRow) -> Option<String> {
    match (
        mapped
            .parent_category
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty()),
        mapped
            .category
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    ) {
        (Some(parent), Some(child)) => Some(format!("{parent} / {child}")),
        (None, Some(name)) => Some(name.to_string()),
        (Some(parent), None) => Some(parent.to_string()),
        (None, None) => None,
    }
}

fn rate_origin(plan: &ImportRatePlan) -> Option<RateOrigin> {
    match plan {
        ImportRatePlan::Manual { .. } => Some(RateOrigin::Manual),
        ImportRatePlan::Lookup
        | ImportRatePlan::Identity
        | ImportRatePlan::Pending { .. }
        | ImportRatePlan::Automatic { .. } => Some(RateOrigin::Supplied),
    }
}

fn count_status(rows: &[ImportPreviewRowResult], status: ImportPreviewRowStatus) -> i32 {
    i32::try_from(rows.iter().filter(|row| row.status == status).count()).unwrap_or(i32::MAX)
}

fn needs_backfill(row: &PersistedCurrency) -> bool {
    !row.disabled && !row.missing_periods.is_empty()
}

pub fn duplicate_candidates_from_request(
    request: &PreviewTransactionImportRequest,
) -> Vec<DuplicateKeyCandidate> {
    let confirmed = request
        .confirmed_transaction_currency
        .as_deref()
        .map(str::trim)
        .filter(|code| !code.is_empty())
        .map(|code| code.to_ascii_uppercase());

    request
        .rows
        .iter()
        .filter(|mapped| !mapped.empty)
        .filter_map(|mapped| {
            let date = mapped
                .date
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .and_then(|value| {
                    parse_datetime(value)
                        .or_else(|_| parse_date_only(value))
                        .ok()
                })?;
            let amount = mapped.amount_minor.filter(|value| *value >= 0)?;
            let currency = if request.has_currency_column {
                mapped
                    .currency
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(|value| value.to_ascii_uppercase())?
            } else {
                confirmed.clone()?
            };
            Some(DuplicateKeyCandidate {
                transaction_date: date,
                amount,
                currency,
                description: mapped
                    .description
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(ToOwned::to_owned),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::currency::CurrencyRefreshStatus;
    use crate::features::transactions::import_models::{MappedExternalRate, RateDirection};

    fn row(currency: Option<&str>) -> MappedImportRow {
        MappedImportRow {
            row_number: 2,
            empty: false,
            date: Some("2026-01-15T08:30:00".to_string()),
            amount_minor: Some(1250),
            currency: currency.map(ToOwned::to_owned),
            transaction_type: Some("expense".to_string()),
            description: Some("Groceries".to_string()),
            notes: None,
            parent_category: Some("Food".to_string()),
            category: Some("Groceries".to_string()),
            mapped_rate: None,
            native: None,
        }
    }

    fn request(
        has_currency_column: bool,
        confirmed: Option<&str>,
        rows: Vec<MappedImportRow>,
    ) -> PreviewTransactionImportRequest {
        PreviewTransactionImportRequest {
            file_digest: "abc".to_string(),
            has_currency_column,
            confirmed_transaction_currency: confirmed.map(ToOwned::to_owned),
            confirm_provider_disclosure: false,
            rows,
        }
    }

    #[test]
    fn currencyless_file_requires_confirmed_currency() {
        let error = classify_import(&request(false, None, vec![row(None)]), &HashSet::new())
            .expect_err("confirmation required");
        assert!(matches!(error, Error::InvalidData(message) if message.contains("Confirm one")));
    }

    #[test]
    fn currencyless_file_uses_confirmed_currency() {
        let classified = classify_import(
            &request(false, Some("EUR"), vec![row(None)]),
            &HashSet::new(),
        )
        .expect("classified");
        assert_eq!(classified.summary.importable_rows, 1);
        assert_eq!(classified.commit.rows[0].transaction.currency, "EUR");
    }

    #[test]
    fn blank_currency_cell_invalidates_row_and_blocks() {
        let classified = classify_import(&request(true, None, vec![row(None)]), &HashSet::new())
            .expect("classified");
        assert_eq!(classified.summary.invalid_rows, 1);
        assert!(classified.summary.blocked);
        assert_eq!(classified.rows[0].status, ImportPreviewRowStatus::Invalid);
    }

    #[test]
    fn empty_rows_are_explicit_skips() {
        let mut empty = row(Some("EUR"));
        empty.empty = true;
        let classified = classify_import(&request(true, None, vec![empty]), &HashSet::new())
            .expect("classified");
        assert_eq!(classified.summary.empty_rows, 1);
        assert!(!classified.summary.blocked);
    }

    #[test]
    fn duplicates_use_original_money_including_currency() {
        let eur = row(Some("EUR"));
        let usd = row(Some("USD"));
        let existing = HashSet::from([duplicate_key(
            parse_datetime("2026-01-15T08:30:00").expect("date"),
            1250,
            "EUR",
            Some("Groceries"),
        )]);
        let classified =
            classify_import(&request(true, None, vec![eur, usd]), &existing).expect("classified");
        assert_eq!(classified.summary.duplicate_rows, 1);
        assert_eq!(classified.summary.importable_rows, 1);
        assert_eq!(classified.commit.rows[0].transaction.currency, "USD");
    }

    #[test]
    fn mapped_external_rate_is_manual() {
        let mut mapped = row(Some("USD"));
        mapped.mapped_rate = Some(MappedExternalRate {
            rate: "1.08".to_string(),
            direction: RateDirection::TransactionToDefault,
            rate_date: None,
        });
        let classified = classify_import(&request(true, None, vec![mapped]), &HashSet::new())
            .expect("classified");
        assert!(matches!(
            classified.commit.rows[0].rate_plan,
            ImportRatePlan::Manual { .. }
        ));
        assert_eq!(classified.rows[0].rate_origin, Some(RateOrigin::Manual));
    }

    #[test]
    fn mapped_external_rate_default_to_transaction_inverts() {
        let mut mapped = row(Some("USD"));
        mapped.mapped_rate = Some(MappedExternalRate {
            rate: "2".to_string(),
            direction: RateDirection::DefaultToTransaction,
            rate_date: None,
        });
        let classified = classify_import(&request(true, None, vec![mapped]), &HashSet::new())
            .expect("classified");
        match &classified.commit.rows[0].rate_plan {
            ImportRatePlan::Manual { decimal, .. } => assert_eq!(decimal, "0.5"),
            other => panic!("expected manual rate, got {other:?}"),
        }
    }

    #[test]
    fn newer_native_export_version_is_rejected() {
        let mut mapped = row(Some("EUR"));
        mapped.native = Some(NativeRateFields {
            export_version: 2,
            rate_variant: RateVariant::Identity,
            rate_state: "complete".to_string(),
            rate_date: "2026-01-15".to_string(),
            source_observation_date: None,
            source_currency: "EUR".to_string(),
            reference_currency: "EUR".to_string(),
            coefficient: Some(1),
            scale: Some(0),
            original_decimal: Some("1".to_string()),
            formula_version: Some(1),
            origin: RateOrigin::Supplied,
        });
        let error = classify_import(&request(true, None, vec![mapped]), &HashSet::new())
            .expect_err("upgrade");
        assert!(matches!(error, Error::InvalidData(message) if message == UPGRADE_EXPORT_MESSAGE));
    }

    #[test]
    fn needed_add_reenable_and_backfill_are_listed() {
        let preparations = currency_preparations(
            &[
                "EUR".to_string(),
                "USD".to_string(),
                "GBP".to_string(),
                "CHF".to_string(),
            ],
            CurrencyPrepContext {
                default_currency: "EUR",
                persisted: &[
                    PersistedCurrency {
                        code: "EUR".to_string(),
                        disabled: false,
                        used_by_recurring: false,
                        coverage_from: None,
                        coverage_to: None,
                        last_refresh: None,
                        refresh_status: CurrencyRefreshStatus::Idle,
                        missing_periods: Vec::new(),
                    },
                    PersistedCurrency {
                        code: "GBP".to_string(),
                        disabled: true,
                        used_by_recurring: false,
                        coverage_from: None,
                        coverage_to: None,
                        last_refresh: None,
                        refresh_status: CurrencyRefreshStatus::Idle,
                        missing_periods: Vec::new(),
                    },
                    PersistedCurrency {
                        code: "CHF".to_string(),
                        disabled: false,
                        used_by_recurring: false,
                        coverage_from: None,
                        coverage_to: None,
                        last_refresh: None,
                        refresh_status: CurrencyRefreshStatus::Failed,
                        missing_periods: vec!["2024-01".to_string()],
                    },
                ],
            },
        );
        assert_eq!(preparations[0].action, CurrencyPrepAction::AlreadyEnabled);
        assert_eq!(preparations[1].action, CurrencyPrepAction::Add);
        assert_eq!(preparations[2].action, CurrencyPrepAction::ReEnable);
        assert_eq!(preparations[3].action, CurrencyPrepAction::Backfill);
    }

    #[test]
    fn stale_binding_detects_revision_and_coverage_changes() {
        let original = binding_for("abc", 1, "set:digest");
        assert!(!original.matches(&binding_for("abc", 2, "set:digest")));
        assert!(!original.matches(&binding_for("def", 1, "set:digest")));
        assert!(!original.matches(&binding_for("abc", 1, "other")));
        assert!(original.matches(&binding_for("abc", 1, "set:digest")));
    }
}
