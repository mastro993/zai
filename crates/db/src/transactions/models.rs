use crate::schema::transactions;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use zai_core::Error;
use zai_core::features::transactions::models::{NewTransaction, Transaction, TransactionUpdate};
use zai_core::money::WIRE_MAX_MINOR_UNITS;

const DEFAULT_IDENTITY_CURRENCY: &str = "EUR";

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
    pub fn from_new(value: NewTransaction, currency: &str) -> Self {
        let now = chrono::Utc::now().naive_utc();
        Self {
            id: value.id.unwrap_or_default(),
            description: value.description,
            amount: i64::from(value.amount),
            currency: currency.to_string(),
            transaction_date: value.transaction_date,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }

    pub fn into_domain(self) -> zai_core::Result<Transaction> {
        if self.amount > WIRE_MAX_MINOR_UNITS {
            return Err(Error::InvalidData(
                "Persisted money exceeds the JavaScript-safe wire maximum".to_string(),
            ));
        }
        Ok(Transaction {
            id: self.id,
            description: self.description,
            amount: i32::try_from(self.amount).map_err(|_| {
                Error::InvalidData(
                    "Persisted money exceeds the JavaScript-safe wire maximum".to_string(),
                )
            })?,
            transaction_date: self.transaction_date,
            transaction_type: self.transaction_type,
            transaction_category_id: self.transaction_category_id,
            notes: self.notes,
        })
    }
}

impl From<NewTransaction> for TransactionRow {
    fn from(value: NewTransaction) -> Self {
        Self::from_new(value, DEFAULT_IDENTITY_CURRENCY)
    }
}

impl From<TransactionRow> for Transaction {
    fn from(value: TransactionRow) -> Self {
        value
            .into_domain()
            .expect("persisted transaction amount exceeds i32 wire cap")
    }
}

impl From<TransactionUpdate> for TransactionRowUpdate {
    fn from(value: TransactionUpdate) -> Self {
        Self {
            description: value.description,
            amount: i64::from(value.amount),
            currency: None,
            transaction_date: value.transaction_date,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
            updated_at: chrono::Utc::now().naive_utc(),
        }
    }
}
