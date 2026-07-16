use super::models::TransactionRow;
use crate::budgets::alerts::{emit_budget_transition_alerts, snapshot_active_budgets};
use crate::budgets::repair_transaction_budget_projections;
use crate::errors::{IntoStorage, Result};
use crate::schema::transactions;
use chrono::{Local, NaiveDateTime};
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::domain_alerts::CommittedOutcome;
use zai_core::features::transactions::models::Transaction;

pub(super) fn delete_transaction(
    conn: &mut SqliteConnection,
    transaction_id: String,
    now: NaiveDateTime,
) -> Result<CommittedOutcome<Transaction>> {
    let before = snapshot_active_budgets(conn, now)?;
    let deleted_at = Local::now().naive_utc();

    let existing = transactions::table
        .find(&transaction_id)
        .first::<TransactionRow>(conn)
        .into_storage()?;

    diesel::update(transactions::table.find(&transaction_id))
        .set(transactions::deleted_at.eq(deleted_at))
        .execute(conn)
        .into_storage()?;

    let deleted = transactions::table
        .find(&transaction_id)
        .filter(transactions::deleted_at.is_not_null())
        .first::<TransactionRow>(conn)
        .into_storage()?;

    repair_transaction_budget_projections(
        conn,
        now,
        std::slice::from_ref(&existing),
        std::slice::from_ref(&deleted),
    )?;
    let after = snapshot_active_budgets(conn, now)?;
    let alerts = emit_budget_transition_alerts(conn, BudgetAlertMode::Transition, &before, &after)?;
    Ok(CommittedOutcome::with_alert_outcomes(
        deleted.into(),
        alerts,
    ))
}

pub(super) fn delete_transactions(
    conn: &mut SqliteConnection,
    owned_ids: Vec<String>,
    now: NaiveDateTime,
) -> Result<CommittedOutcome<Vec<Transaction>>> {
    let before = snapshot_active_budgets(conn, now)?;
    let deleted_at = Local::now().naive_utc();

    let existing = transactions::table
        .filter(transactions::id.eq_any(&owned_ids))
        .load::<TransactionRow>(conn)
        .into_storage()?;

    diesel::update(transactions::table.filter(transactions::id.eq_any(&owned_ids)))
        .set(transactions::deleted_at.eq(deleted_at))
        .execute(conn)
        .into_storage()?;

    let deleted = transactions::table
        .filter(transactions::id.eq_any(&owned_ids))
        .filter(transactions::deleted_at.is_not_null())
        .load::<TransactionRow>(conn)
        .into_storage()?;

    let deleted_transactions: Vec<Transaction> =
        deleted.iter().cloned().map(Transaction::from).collect();
    repair_transaction_budget_projections(conn, now, &existing, &deleted)?;
    let after = snapshot_active_budgets(conn, now)?;
    let alerts = emit_budget_transition_alerts(conn, BudgetAlertMode::Transition, &before, &after)?;
    Ok(CommittedOutcome::with_alert_outcomes(
        deleted_transactions,
        alerts,
    ))
}
