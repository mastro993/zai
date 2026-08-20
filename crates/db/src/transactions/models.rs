use crate::schema::transactions;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use zai_core::features::transactions::models::{NewTransaction, TransactionUpdate};

#[derive(AsChangeset)]
#[diesel(table_name = transactions)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct TransactionRowUpdate {
    #[diesel(treat_none_as_null = true)]
    pub description: Option<String>,
    pub amount: i64,
    pub currency: Option<String>,
    pub transaction_date: NaiveDateTime,
    pub transaction_type: String,
    #[diesel(treat_none_as_null = true)]
    pub transaction_category_id: Option<String>,
    #[diesel(treat_none_as_null = true)]
    pub notes: Option<String>,
    pub updated_at: NaiveDateTime,
}

#[derive(Queryable, Identifiable, Insertable, Selectable, PartialEq, Debug, Clone)]
#[diesel(table_name = transactions)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct TransactionRow {
    pub id: String,
    pub description: Option<String>,
    pub amount: i64,
    pub currency: String,
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

impl TransactionRow {
    pub fn from_new(value: NewTransaction) -> Self {
        let now = chrono::Utc::now().naive_utc();
        Self {
            id: value.id.unwrap_or_default(),
            description: value.description,
            amount: i64::from(value.amount),
            currency: value.currency,
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

impl From<NewTransaction> for TransactionRow {
    fn from(value: NewTransaction) -> Self {
        Self::from_new(value)
    }
}

impl From<TransactionUpdate> for TransactionRowUpdate {
    fn from(value: TransactionUpdate) -> Self {
        Self {
            description: value.description,
            amount: i64::from(value.amount),
            currency: Some(value.currency),
            transaction_date: value.transaction_date,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
            updated_at: chrono::Utc::now().naive_utc(),
        }
    }
}
