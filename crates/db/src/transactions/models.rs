use crate::schema::transactions;
use crate::tz::{utc_to_wall, wall_to_utc};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use zai_core::features::transactions::models::{NewTransaction, Transaction, TransactionUpdate};
use zai_core::time::IanaZone;

#[derive(AsChangeset)]
#[diesel(table_name = transactions)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct TransactionRowUpdate {
    #[diesel(treat_none_as_null = true)]
    pub description: Option<String>,
    pub amount: i32,
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
    pub time_zone: String,
}

impl TransactionRow {
    /// Stored `transaction_date` is UTC; project it back to the wall clock of
    /// the zone captured at write time. Never treats UTC as wall time.
    pub fn wall_transaction_date(&self) -> NaiveDateTime {
        utc_to_wall(self.transaction_date, &self.time_zone).unwrap_or_else(|err| {
            panic!(
                "persisted transaction time_zone must be valid IANA (id={}): {err}",
                self.id
            )
        })
    }

    pub fn from_new(value: NewTransaction, zone: &IanaZone) -> zai_core::Result<Self> {
        let now = chrono::Utc::now().naive_utc();
        Ok(Self {
            id: value.id.unwrap_or_default(),
            description: value.description,
            amount: value.amount,
            transaction_date: wall_to_utc(value.transaction_date, zone)?,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
            created_at: now,
            updated_at: now,
            deleted_at: None,
            time_zone: zone.name().to_string(),
        })
    }
}

impl From<TransactionRow> for Transaction {
    fn from(value: TransactionRow) -> Self {
        Self {
            id: value.id.clone(),
            transaction_date: value.wall_transaction_date(),
            description: value.description,
            amount: value.amount,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
        }
    }
}

impl TransactionRowUpdate {
    pub fn from_update(value: TransactionUpdate, zone: &IanaZone) -> zai_core::Result<Self> {
        Ok(Self {
            description: value.description,
            amount: value.amount,
            transaction_date: wall_to_utc(value.transaction_date, zone)?,
            transaction_type: value.transaction_type,
            transaction_category_id: value.transaction_category_id,
            notes: value.notes,
            updated_at: chrono::Utc::now().naive_utc(),
        })
    }
}
