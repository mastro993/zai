use std::sync::Arc;

use chrono::Local;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::domain_alerts::{CommittedOutcome, publish_created_alerts};
use zai_core::features::transactions::models::Transaction;

use super::models::TransactionRow;
use super::repository::TransactionsRepository;
use crate::budgets::alerts::{emit_budget_transition_alerts, snapshot_active_budgets};
use crate::budgets::timeline::{BudgetPeriodTimeline, SourceChange};
use crate::errors::IntoStorage;
use crate::schema::transactions;

pub(super) async fn delete_transaction(
    repository: &TransactionsRepository,
    id: &str,
) -> Result<Transaction> {
    let transaction_id = id.to_owned();
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

                BudgetPeriodTimeline::reconcile(
                    conn,
                    SourceChange::Transactions {
                        old: vec![existing.clone()],
                        new: vec![deleted.clone()],
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
                Ok(CommittedOutcome::with_alert_outcomes(deleted.into(), alerts))
            },
        )
        .await?;
    publish_created_alerts(publisher.as_ref(), &outcome);
    Ok(outcome.value)
}

pub(super) async fn delete_transactions(
    repository: &TransactionsRepository,
    ids: Vec<&str>,
) -> Result<Vec<Transaction>> {
    let owned_ids = ids.iter().map(|&s| s.to_string()).collect::<Vec<String>>();
    let clock = Arc::clone(&repository.clock);
    let publisher = Arc::clone(&repository.alert_publisher);

    let outcome = repository
        .writer
        .exec(
            move |conn: &mut SqliteConnection| -> crate::errors::Result<
                CommittedOutcome<Vec<Transaction>>,
            > {
                let now = clock.sample();
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
                BudgetPeriodTimeline::reconcile(
                    conn,
                    SourceChange::Transactions {
                        old: existing.clone(),
                        new: deleted.clone(),
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
                    deleted_transactions,
                    alerts,
                ))
            },
        )
        .await?;
    publish_created_alerts(publisher.as_ref(), &outcome);
    Ok(outcome.value)
}
