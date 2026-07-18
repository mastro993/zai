use std::sync::Arc;

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::domain_alerts::{CommittedOutcome, publish_created_alerts};
use zai_core::features::transactions::models::{NewTransaction, Transaction, TransactionUpdate};

use super::models::{TransactionRow, TransactionRowUpdate};
use super::repository::TransactionsRepository;
use crate::budgets::alerts::{emit_budget_transition_alerts, snapshot_active_budgets};
use crate::budgets::timeline::{BudgetPeriodTimeline, SourceChange};
use crate::errors::IntoStorage;
use crate::schema::transactions;

pub(super) async fn create_transaction(
    repository: &TransactionsRepository,
    new_transaction: NewTransaction,
) -> Result<Transaction> {
    let clock = Arc::clone(&repository.clock);
    let publisher = Arc::clone(&repository.alert_publisher);
    let outcome = repository
        .writer
        .exec(
            move |conn: &mut SqliteConnection| -> crate::errors::Result<
                CommittedOutcome<Transaction>,
            > {
                let now = clock.sample();
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

                BudgetPeriodTimeline::reconcile(
                    conn,
                    SourceChange::Transactions {
                        old: vec![],
                        new: vec![inserted.clone()],
                    },
                    now,
                )?;
                let after = snapshot_active_budgets(conn, now)?;
                let alerts = emit_budget_transition_alerts(
                    conn,
                    BudgetAlertMode::Transition,
                    &before,
                    &after,
                )?;
                Ok(CommittedOutcome::with_alert_outcomes(
                    inserted.into(),
                    alerts,
                ))
            },
        )
        .await?;
    publish_created_alerts(publisher.as_ref(), &outcome);
    Ok(outcome.value)
}

pub(super) async fn update_transaction(
    repository: &TransactionsRepository,
    updated_transaction: TransactionUpdate,
) -> Result<Transaction> {
    let clock = Arc::clone(&repository.clock);
    let publisher = Arc::clone(&repository.alert_publisher);
    let outcome = repository
        .writer
        .exec(
            move |conn: &mut SqliteConnection| -> crate::errors::Result<
                CommittedOutcome<Transaction>,
            > {
                let now = clock.sample();
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

                BudgetPeriodTimeline::reconcile(
                    conn,
                    SourceChange::Transactions {
                        old: vec![existing.clone()],
                        new: vec![persisted.clone()],
                    },
                    now,
                )?;
                let after = snapshot_active_budgets(conn, now)?;
                let alerts = emit_budget_transition_alerts(
                    conn,
                    BudgetAlertMode::Transition,
                    &before,
                    &after,
                )?;
                Ok(CommittedOutcome::with_alert_outcomes(persisted.into(), alerts))
            },
        )
        .await?;
    publish_created_alerts(publisher.as_ref(), &outcome);
    Ok(outcome.value)
}
