use crate::schema::transaction_categories;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use zai_core::features::transaction_categories::models::{
    NewTransactionCategory, TransactionCategory, TransactionCategoryUpdate,
};

#[derive(Queryable, Identifiable, Insertable, AsChangeset, Selectable, PartialEq, Debug, Clone)]
#[diesel(table_name = transaction_categories)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[diesel(belongs_to(TransactionCategoryRow, foreign_key = parent_id))]
pub struct TransactionCategoryRow {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    #[diesel(skip_insertion)]
    pub created_at: NaiveDateTime,
    #[diesel(skip_insertion)]
    pub updated_at: NaiveDateTime,
    pub deleted_at: Option<NaiveDateTime>,
}

impl From<TransactionCategoryRow> for TransactionCategory {
    fn from(value: TransactionCategoryRow) -> Self {
        Self {
            id: value.id,
            parent_id: value.parent_id,
            name: value.name,
            description: value.description,
            color: value.color,
            parent: None,
        }
    }
}

impl From<NewTransactionCategory> for TransactionCategoryRow {
    fn from(value: NewTransactionCategory) -> Self {
        let now = chrono::Utc::now().naive_utc();
        Self {
            id: value.id.unwrap_or_default(),
            parent_id: value.parent_id,
            name: value.name,
            description: value.description,
            color: value.color,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }
}

impl From<TransactionCategoryUpdate> for TransactionCategoryRow {
    fn from(value: TransactionCategoryUpdate) -> Self {
        let now = chrono::Utc::now().naive_utc();
        Self {
            id: value.id,
            parent_id: value.parent_id,
            name: value.name,
            description: value.description,
            color: value.color,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }
}
