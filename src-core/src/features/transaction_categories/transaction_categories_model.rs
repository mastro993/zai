use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

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
#[diesel(table_name = crate::schema::transaction_category)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTransactionCategory {
    pub id: Option<String>,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

/// Input model for updating an existing account
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatedTransactionCategory {
    pub id: Option<String>,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}
