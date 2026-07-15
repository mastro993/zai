use crate::Error;
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
    let trimmed = value.trim();
    if ALLOWED_TYPES.contains(&trimmed) {
        Ok(())
    } else {
        Err(Error::InvalidData(format!(
            "Invalid transaction type: {trimmed}"
        )))
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub description: Option<String>,
    pub amount: i32,
    pub transaction_date: NaiveDateTime,
    pub transaction_type: String,
    pub transaction_category_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTransaction {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub description: Option<String>,
    pub amount: i32,
    pub transaction_date: NaiveDateTime,
    pub transaction_type: String,
    pub transaction_category_id: Option<String>,
    pub notes: Option<String>,
}

impl NewTransaction {
    pub fn validate(&self) -> Result<(), Error> {
        validate_transaction_type(&self.transaction_type)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionUpdate {
    pub id: String,
    pub description: Option<String>,
    pub amount: i32,
    pub transaction_date: NaiveDateTime,
    pub transaction_type: String,
    pub transaction_category_id: Option<String>,
    pub notes: Option<String>,
}

impl TransactionUpdate {
    pub fn validate(&self) -> Result<(), Error> {
        if self.id.trim().is_empty() {
            return Err(Error::InvalidData(
                "Transaction id is required for updates".to_string(),
            ));
        }
        validate_transaction_type(&self.transaction_type)
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionsSearchResponse {
    pub data: Vec<Transaction>,
    pub total_row_count: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_date() -> NaiveDateTime {
        NaiveDateTime::parse_from_str("2026-07-08T12:00:00", "%Y-%m-%dT%H:%M:%S")
            .expect("sample date")
    }

    #[tokio::test]
    async fn test_new_transaction_validation_accepts_allowed_types() {
        for transaction_type in ["expense", "income"] {
            let transaction = NewTransaction {
                id: None,
                description: Some("Lunch".to_string()),
                amount: 1200,
                transaction_date: sample_date(),
                transaction_type: transaction_type.to_string(),
                transaction_category_id: None,
                notes: None,
            };

            transaction.validate().expect("validate");
        }
    }

    #[tokio::test]
    async fn test_new_transaction_validation_rejects_invalid_types() {
        for transaction_type in ["", "transfer", "EXPENSE"] {
            let transaction = NewTransaction {
                id: None,
                description: Some("Lunch".to_string()),
                amount: 1200,
                transaction_date: sample_date(),
                transaction_type: transaction_type.to_string(),
                transaction_category_id: None,
                notes: None,
            };

            let result = transaction.validate();

            assert!(result.is_err());
        }
    }

    #[tokio::test]
    async fn test_transaction_update_validation_accepts_allowed_types() {
        for transaction_type in ["expense", "income"] {
            let transaction = TransactionUpdate {
                id: "txn-1".to_string(),
                description: Some("Salary".to_string()),
                amount: 5000,
                transaction_date: sample_date(),
                transaction_type: transaction_type.to_string(),
                transaction_category_id: None,
                notes: None,
            };

            transaction.validate().expect("validate");
        }
    }

    #[tokio::test]
    async fn test_transaction_update_validation_rejects_invalid_types() {
        for transaction_type in ["", "transfer", "EXPENSE"] {
            let transaction = TransactionUpdate {
                id: "txn-1".to_string(),
                description: Some("Salary".to_string()),
                amount: 5000,
                transaction_date: sample_date(),
                transaction_type: transaction_type.to_string(),
                transaction_category_id: None,
                notes: None,
            };

            let result = transaction.validate();

            assert!(result.is_err());
        }
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
}
