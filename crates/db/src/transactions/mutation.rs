use super::models::{TransactionRow, TransactionRowUpdate};
use crate::budgets::alerts::{emit_budget_transition_alerts, snapshot_active_budgets};
use crate::budgets::repair_transaction_budget_projections;
use crate::errors::{IntoStorage, Result};
use crate::schema::transactions;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::domain_alerts::CommittedOutcome;
use zai_core::features::transactions::models::{NewTransaction, Transaction, TransactionUpdate};

pub(super) fn create_transaction(
    conn: &mut SqliteConnection,
    new_transaction: NewTransaction,
    now: NaiveDateTime,
) -> Result<CommittedOutcome<Transaction>> {
    let before = snapshot_active_budgets(conn, now)?;
    let transaction: TransactionRow = new_transaction.into();
    let transaction_id = transaction.id.clone();

    diesel::insert_into(transactions::table)
        .values(&transaction)
        .execute(conn)
        .into_storage()?;

    let inserted = transactions::table
        .filter(transactions::id.eq(&transaction_id))
        .first::<TransactionRow>(conn)
        .into_storage()?;

    repair_transaction_budget_projections(conn, now, &[], std::slice::from_ref(&inserted))?;
    let after = snapshot_active_budgets(conn, now)?;
    let alerts = emit_budget_transition_alerts(conn, BudgetAlertMode::Transition, &before, &after)?;
    Ok(CommittedOutcome::with_alert_outcomes(
        inserted.into(),
        alerts,
    ))
}

pub(super) fn update_transaction(
    conn: &mut SqliteConnection,
    updated_transaction: TransactionUpdate,
    now: NaiveDateTime,
) -> Result<CommittedOutcome<Transaction>> {
    let before = snapshot_active_budgets(conn, now)?;
    let transaction_id = updated_transaction.id.clone();
    let mut changeset: TransactionRowUpdate = updated_transaction.into();
    changeset.updated_at = now;

    let existing = transactions::table
        .find(&transaction_id)
        .first::<TransactionRow>(conn)
        .into_storage()?;

    diesel::update(transactions::table.find(&transaction_id))
        .set(&changeset)
        .execute(conn)
        .into_storage()?;

    let persisted = transactions::table
        .find(&transaction_id)
        .filter(transactions::deleted_at.is_null())
        .first::<TransactionRow>(conn)
        .into_storage()?;

    repair_transaction_budget_projections(
        conn,
        now,
        std::slice::from_ref(&existing),
        std::slice::from_ref(&persisted),
    )?;
    let after = snapshot_active_budgets(conn, now)?;
    let alerts = emit_budget_transition_alerts(conn, BudgetAlertMode::Transition, &before, &after)?;
    Ok(CommittedOutcome::with_alert_outcomes(
        persisted.into(),
        alerts,
    ))
}
