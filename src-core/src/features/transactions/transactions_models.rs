use crate::Error;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionSearchFilters<'a> {
    pub query: Option<&'a str>,
    pub categories_filter: Option<Vec<&'a str>>,
    pub transaction_type_filter: Option<&'a str>,
    pub start_date_filter: Option<NaiveDateTime>,
    pub end_date_filter: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub description: Option<String>,
    pub amount: i32,
    pub date: NaiveDateTime,
    pub transaction_type: String,
    pub transaction_category_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(
    Queryable,
    Identifiable,
    Insertable,
    AsChangeset,
    Selectable,
    PartialEq,
    Serialize,
    Deserialize,
    Debug,
    Clone,
)]
#[diesel(table_name = crate::schema::transactions)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct TransactionRow {
    pub id: String,
    pub description: Option<String>,
    pub amount: i32,
    pub date: NaiveDateTime,
    pub transaction_type: String,
    pub transaction_category_id: Option<String>,
    pub notes: Option<String>,

    #[diesel(skip_insertion)]
    pub created_at: NaiveDateTime,
    #[diesel(skip_insertion)]
    pub updated_at: NaiveDateTime,
    pub deleted_at: Option<NaiveDateTime>,
}

impl From<TransactionRow> for Transaction {
    fn from(value: TransactionRow) -> Self {
        Self {
            id: value.id,
            description: value.description,
            amount: value.amount,
            date: value.date,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTransaction {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub description: Option<String>,
    pub amount: i32,
    pub date: NaiveDateTime,
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

impl From<NewTransaction> for TransactionRow {
    fn from(value: NewTransaction) -> Self {
        let now = chrono::Utc::now().naive_utc();
        Self {
            id: value.id.unwrap_or_default(),
            description: value.description,
            amount: value.amount,
            date: value.date,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionUpdate {
    pub id: String,
    pub description: Option<String>,
    pub amount: i32,
    pub date: NaiveDateTime,
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

impl From<TransactionUpdate> for TransactionRow {
    fn from(value: TransactionUpdate) -> Self {
        let now = chrono::Utc::now().naive_utc();
        Self {
            id: value.id,
            description: value.description,
            amount: value.amount,
            date: value.date,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionsSearchResponse {
    pub data: Vec<Transaction>,
    pub total_row_count: i64,
}
