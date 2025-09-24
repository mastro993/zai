use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use super::transaction_categories_errors::TransactionCategoryError;

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
#[diesel(table_name = crate::schema::transaction_categories)]
#[serde(rename_all = "camelCase")]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct TransactionCategory {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
    pub deleted_at: Option<NaiveDateTime>,
}

#[derive(Insertable, Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
#[diesel(table_name = crate::schema::transaction_categories)]
pub struct NewTransactionCategory {
    pub id: Option<String>,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

impl NewTransactionCategory {
    pub fn validate(&self) -> Result<(), TransactionCategoryError> {
        if self.name.trim().is_empty() {
            return Err(TransactionCategoryError::InvalidData(
                "Name cannot be empty".to_string(),
            ));
        }
        Ok(())
    }
}