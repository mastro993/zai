use crate::Error;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

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
        if self.transaction_type.trim().is_empty() {
            return Err(Error::InvalidData(
                "Transaction type cannot be empty".to_string(),
            ));
        }
        Ok(())
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
        if self.transaction_type.trim().is_empty() {
            return Err(Error::InvalidData(
                "Transaction type cannot be empty".to_string(),
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionsSearchResponse {
    pub data: Vec<Transaction>,
    pub total_row_count: i64,
}
