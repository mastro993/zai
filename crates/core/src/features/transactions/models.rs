use crate::Error;
use crate::money::CurrencyCode;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

const ALLOWED_TYPES: &[&str] = &["expense", "income"];
const MAX_LIST_PAGE_SIZE: i64 = 100;

pub fn validate_list_paging(page: i64, per_page: i64) -> crate::Result<()> {
    if page < 1 || !(1..=MAX_LIST_PAGE_SIZE).contains(&per_page) {
        return Err(Error::InvalidData(
            "Transaction list page must be at least 1 and page size must be between 1 and 100"
                .to_string(),
        ));
    }
    page.checked_sub(1)
        .and_then(|value| value.checked_mul(per_page))
        .ok_or_else(|| Error::InvalidData("Transaction list page is too large".to_string()))?;
    Ok(())
}

fn validate_transaction_type(value: &str) -> Result<(), Error> {
    if ALLOWED_TYPES.contains(&value) {
        Ok(())
    } else {
        Err(Error::InvalidData(format!(
            "Invalid transaction type: {value}"
        )))
    }
}

fn validate_amount(amount: i32) -> Result<(), Error> {
    if amount < 0 {
        return Err(Error::InvalidData(
            "Transaction amount cannot be negative".to_string(),
        ));
    }
    Ok(())
}

fn validate_currency(code: &str) -> Result<(), Error> {
    match CurrencyCode::parse(code) {
        Ok(_) => Ok(()),
        Err(Error::InvalidData(message)) if message.starts_with("Unsupported currency code") => {
            Err(Error::UnsupportedCurrency(code.trim().to_ascii_uppercase()))
        }
        Err(error) => Err(error),
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionSearchFilters<'a> {
    pub query: Option<&'a str>,
    /// `None` means no category filter. `Some([])` means uncategorized only
    /// (`transaction_category_id IS NULL`). `Some([ids])` filters to those categories.
    pub categories: Option<Vec<&'a str>>,
    pub transaction_type: Option<&'a str>,
    pub start_date: Option<NaiveDateTime>,
    pub end_date: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RateVariant {
    Identity,
    Automatic,
    Manual,
    Pending,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RateOrigin {
    Supplied,
    Manual,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionExchangeRateRevision {
    pub variant: RateVariant,
    pub rate_date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_observation_date: Option<String>,
    pub source_currency: String,
    pub reference_currency: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_decimal: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coefficient: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scale: Option<u32>,
    pub origin: RateOrigin,
}

impl TransactionExchangeRateRevision {
    pub fn identity(currency: &str, rate_date: NaiveDateTime) -> Self {
        Self {
            variant: RateVariant::Identity,
            rate_date: rate_date.date().format("%Y-%m-%d").to_string(),
            source_observation_date: None,
            source_currency: currency.to_string(),
            reference_currency: currency.to_string(),
            original_decimal: Some("1".to_string()),
            coefficient: Some(1),
            scale: Some(0),
            origin: RateOrigin::Supplied,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionListRecurring {
    pub recurring_transaction_id: String,
    pub fulfillment_position: i32,
    pub total_occurrences: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionListItem {
    pub id: String,
    pub description: Option<String>,
    pub transaction_date: NaiveDateTime,
    pub transaction_type: String,
    pub transaction_category_id: Option<String>,
    pub notes: Option<String>,
    pub amount: i32,
    pub currency: String,
    pub converted_amount: Option<i32>,
    pub converted_currency: String,
    pub complete: bool,
    pub recurring: Option<TransactionListRecurring>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub description: Option<String>,
    pub amount: i32,
    pub currency: String,
    pub transaction_date: NaiveDateTime,
    pub transaction_type: String,
    pub transaction_category_id: Option<String>,
    pub notes: Option<String>,
    pub exchange_rate: TransactionExchangeRateRevision,
    pub converted_amount: Option<i32>,
    pub converted_currency: String,
    pub complete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTransaction {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub description: Option<String>,
    pub amount: i32,
    pub currency: String,
    pub transaction_date: NaiveDateTime,
    pub transaction_type: String,
    pub transaction_category_id: Option<String>,
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manual_exchange_rate: Option<String>,
}

impl NewTransaction {
    pub fn validate(&self) -> Result<(), Error> {
        validate_amount(self.amount)?;
        validate_currency(&self.currency)?;
        validate_transaction_type(&self.transaction_type)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionUpdate {
    pub id: String,
    pub description: Option<String>,
    pub amount: i32,
    pub currency: String,
    pub transaction_date: NaiveDateTime,
    pub transaction_type: String,
    pub transaction_category_id: Option<String>,
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manual_exchange_rate: Option<String>,
    #[serde(default)]
    pub confirm_manual_rate_replacement: bool,
    #[serde(default)]
    pub retry_rate_lookup: bool,
}

impl TransactionUpdate {
    pub fn validate(&self) -> Result<(), Error> {
        if self.id.trim().is_empty() {
            return Err(Error::InvalidData(
                "Transaction id is required for updates".to_string(),
            ));
        }
        validate_amount(self.amount)?;
        validate_currency(&self.currency)?;
        validate_transaction_type(&self.transaction_type)
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionsSearchResponse {
    pub data: Vec<TransactionListItem>,
    pub total_row_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateKeyCandidate {
    pub transaction_date: NaiveDateTime,
    pub amount: i32,
    pub currency: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionCsvExportResponse {
    pub csv: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_date() -> NaiveDateTime {
        NaiveDateTime::parse_from_str("2026-07-08T12:00:00", "%Y-%m-%dT%H:%M:%S")
            .expect("sample date")
    }

    fn new_txn(transaction_type: &str, amount: i32) -> NewTransaction {
        NewTransaction {
            id: None,
            description: Some("Lunch".to_string()),
            amount,
            currency: "EUR".to_string(),
            transaction_date: sample_date(),
            transaction_type: transaction_type.to_string(),
            transaction_category_id: None,
            notes: None,
            manual_exchange_rate: None,
        }
    }

    fn update_txn(transaction_type: &str, amount: i32) -> TransactionUpdate {
        TransactionUpdate {
            id: "txn-1".to_string(),
            description: Some("Salary".to_string()),
            amount,
            currency: "EUR".to_string(),
            transaction_date: sample_date(),
            transaction_type: transaction_type.to_string(),
            transaction_category_id: None,
            notes: None,
            manual_exchange_rate: None,
            confirm_manual_rate_replacement: false,
            retry_rate_lookup: false,
        }
    }

    #[test]
    fn new_transaction_validation_accepts_allowed_types() {
        for transaction_type in ["expense", "income"] {
            new_txn(transaction_type, 1200)
                .validate()
                .expect("validate");
        }
    }

    #[test]
    fn new_transaction_validation_rejects_invalid_types() {
        for transaction_type in ["", "transfer", "EXPENSE", " expense "] {
            assert!(
                new_txn(transaction_type, 1200).validate().is_err(),
                "transaction type {transaction_type:?} must be rejected"
            );
        }
    }

    #[test]
    fn transaction_update_validation_accepts_allowed_types() {
        for transaction_type in ["expense", "income"] {
            update_txn(transaction_type, 5000)
                .validate()
                .expect("validate");
        }
    }

    #[test]
    fn transaction_update_validation_rejects_invalid_types() {
        for transaction_type in ["", "transfer", "EXPENSE", " expense "] {
            assert!(
                update_txn(transaction_type, 5000).validate().is_err(),
                "transaction type {transaction_type:?} must be rejected"
            );
        }
    }

    #[test]
    fn new_transaction_validation_rejects_negative_amounts() {
        assert!(new_txn("expense", -1).validate().is_err());
    }

    #[test]
    fn transaction_update_validation_rejects_negative_amounts() {
        assert!(update_txn("expense", -1).validate().is_err());
    }

    #[test]
    fn new_transaction_validation_rejects_unsupported_currency() {
        let mut transaction = new_txn("expense", 100);
        transaction.currency = "ZZZ".to_string();
        let error = transaction.validate().expect_err("unsupported");
        assert!(matches!(error, Error::UnsupportedCurrency(code) if code == "ZZZ"));
    }

    #[test]
    fn list_paging_accepts_boundary_values() {
        validate_list_paging(1, 1).expect("minimum page size");
        validate_list_paging(1, 100).expect("maximum page size");
        validate_list_paging(2, 50).expect("valid offset");
    }

    #[test]
    fn list_paging_rejects_invalid_page_values() {
        assert!(validate_list_paging(0, 50).is_err());
        assert!(validate_list_paging(-1, 50).is_err());
    }

    #[test]
    fn list_paging_rejects_invalid_page_size_values() {
        assert!(validate_list_paging(1, 0).is_err());
        assert!(validate_list_paging(1, -1).is_err());
        assert!(validate_list_paging(1, 101).is_err());
    }

    #[test]
    fn list_paging_rejects_offset_overflow() {
        assert!(validate_list_paging(i64::MAX, 2).is_err());
    }

    #[test]
    fn list_item_serializes_finite_and_indefinite_recurring() {
        let item = TransactionListItem {
            id: "txn-1".to_string(),
            description: Some("Rent".to_string()),
            transaction_date: sample_date(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
            amount: 1200,
            currency: "EUR".to_string(),
            converted_amount: Some(1200),
            converted_currency: "EUR".to_string(),
            complete: true,
            recurring: Some(TransactionListRecurring {
                recurring_transaction_id: "rt-1".to_string(),
                fulfillment_position: 2,
                total_occurrences: Some(12),
            }),
        };
        let json = serde_json::to_value(&item).expect("serialize");
        assert_eq!(json["recurring"]["recurringTransactionId"], "rt-1");
        assert_eq!(json["recurring"]["fulfillmentPosition"], 2);
        assert_eq!(json["recurring"]["totalOccurrences"], 12);

        let indefinite = TransactionListRecurring {
            recurring_transaction_id: "rt-2".to_string(),
            fulfillment_position: 1,
            total_occurrences: None,
        };
        let json = serde_json::to_value(indefinite).expect("serialize");
        assert_eq!(json["fulfillmentPosition"], 1);
        assert!(json["totalOccurrences"].is_null());
    }
}
