use crate::schema::transactions;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use zai_core::features::transactions::models::{NewTransaction, Transaction, TransactionUpdate};

#[derive(Queryable, Identifiable, Insertable, AsChangeset, Selectable, PartialEq, Debug, Clone)]
#[diesel(table_name = transactions)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct TransactionRow {
    pub id: String,
    pub description: Option<String>,
    pub amount: i32,
    pub transaction_date: NaiveDateTime,
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
            transaction_date: value.transaction_date,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
        }
    }
}

impl From<NewTransaction> for TransactionRow {
    fn from(value: NewTransaction) -> Self {
        let now = chrono::Utc::now().naive_utc();
        Self {
            id: value.id.unwrap_or_default(),
            description: value.description,
            amount: value.amount,
            transaction_date: value.transaction_date,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }
}

impl From<TransactionUpdate> for TransactionRow {
    fn from(value: TransactionUpdate) -> Self {
        let now = chrono::Utc::now().naive_utc();
        Self {
            id: value.id,
            description: value.description,
            amount: value.amount,
            transaction_date: value.transaction_date,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }
}
