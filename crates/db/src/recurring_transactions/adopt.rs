use super::create::create_recurring_transaction;
use super::fulfill_head::complete_or_advance_after_fulfillment;
use super::models::RecurringOccurrenceRow;
use super::queries::{find_provenance_by_transaction, get_recurring_transaction};
use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::{recurring_occurrences, transactions};
use crate::transactions::models::TransactionRow;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    AdoptRecurringTransaction, FulfillmentKind, NewRecurringTransaction, RecurringTransaction,
};

pub fn find_visible_transaction_date(
    conn: &mut SqliteConnection,
    transaction_id: &str,
) -> Result<NaiveDateTime> {
    let row = load_visible_transaction(conn, transaction_id)?;
    Ok(row.transaction_date)
}

pub fn adopt_existing_transaction(
    conn: &mut SqliteConnection,
    input: AdoptRecurringTransaction,
    now: NaiveDateTime,
) -> Result<RecurringTransaction> {
    let transaction = load_visible_transaction(conn, &input.transaction_id)?;

    if find_provenance_by_transaction(conn, &input.transaction_id)
        .map_err(StorageError::from)?
        .is_some()
    {
        return Err(StorageError::CoreError(Error::Conflict(
            "Transaction already has recurring provenance".to_string(),
        )));
    }

    let create_input = NewRecurringTransaction {
        id: input.id.clone(),
        schedule: input.schedule.clone(),
        first_scheduled_local: transaction.transaction_date,
        total_occurrences: input.total_occurrences,
        template: input.template.clone(),
    };
    let created = create_recurring_transaction(conn, create_input)?;
    let schedule = super::create::find_open_schedule_revision(conn, &created.id)
        .map_err(StorageError::from)?
        .ok_or_else(|| {
            StorageError::CoreError(Error::Repository(
                "Missing schedule revision after adopt create".to_string(),
            ))
        })?;
    let template = super::create::find_open_template_revision(conn, &created.id)
        .map_err(StorageError::from)?
        .ok_or_else(|| {
            StorageError::CoreError(Error::Repository(
                "Missing template revision after adopt create".to_string(),
            ))
        })?;

    diesel::insert_into(recurring_occurrences::table)
        .values(RecurringOccurrenceRow {
            recurring_transaction_id: created.id.clone(),
            schedule_revision_id: schedule.id.clone(),
            ordinal: 1,
            scheduled_local: transaction.transaction_date,
            template_revision_id: template.id.clone(),
            fulfilled_at: now,
            fulfillment_position: 1,
            transaction_id: transaction.id.clone(),
            fulfillment_kind: FulfillmentKind::Adopted.as_str().to_string(),
            recurring_alert_id: None,
        })
        .execute(conn)
        .into_storage()?;

    complete_or_advance_after_fulfillment(conn, &created, &schedule, 1, 1, now)?;
    get_recurring_transaction(conn, &created.id).map_err(StorageError::from)
}

fn load_visible_transaction(
    conn: &mut SqliteConnection,
    transaction_id: &str,
) -> Result<TransactionRow> {
    let row = transactions::table
        .find(transaction_id)
        .filter(transactions::deleted_at.is_null())
        .first::<TransactionRow>(conn)
        .optional()
        .into_storage()?
        .ok_or_else(|| {
            StorageError::CoreError(Error::NotFound(format!(
                "Transaction {transaction_id} not found"
            )))
        })?;
    Ok(row)
}
