use std::sync::Arc;

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::domain_alerts::{CommittedOutcome, publish_created_alerts};
use zai_core::features::transactions::models::{NewTransaction, Transaction, TransactionUpdate};

use super::models::{TransactionRow, TransactionRowUpdate};
use super::rate_revisions::{
    apply_create_rate, apply_update_rate, require_selectable_currency, transaction_detail,
};
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
                require_selectable_currency(conn, &new_transaction.currency)
                    .map_err(crate::errors::StorageError::from)?;
                let manual_rate = new_transaction.manual_exchange_rate.clone();
                let transaction = TransactionRow::from_new(new_transaction);
                let transaction_id = transaction.id.clone();

                diesel::insert_into(transactions::table)
                    .values(&transaction)
                    .execute(conn)
                    .into_storage()?;
                apply_create_rate(conn, &transaction, manual_rate.as_deref())
                    .map_err(crate::errors::StorageError::from)?;

                let inserted = transactions::table
                    .filter(transactions::id.eq(&transaction_id))
                    .first::<TransactionRow>(conn)
                    .into_storage()?;
                crate::valuations::upsert_transaction_valuation(conn, &inserted)
                    .map_err(crate::errors::StorageError::from)?;

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
                    transaction_detail(conn, inserted)
                        .map_err(crate::errors::StorageError::from)?,
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
                let mut changeset: TransactionRowUpdate = updated_transaction.clone().into();
                changeset.updated_at = now;

                let existing = transactions::table
                    .find(&transaction_id)
                    .first::<TransactionRow>(conn)
                    .into_storage()?;
                if existing.currency != updated_transaction.currency {
                    require_selectable_currency(conn, &updated_transaction.currency)
                        .map_err(crate::errors::StorageError::from)?;
                }

                diesel::update(transactions::table.find(&transaction_id))
                    .set(&changeset)
                    .execute(conn)
                    .into_storage()?;

                let persisted = transactions::table
                    .find(&transaction_id)
                    .filter(transactions::deleted_at.is_null())
                    .first::<TransactionRow>(conn)
                    .into_storage()?;
                apply_update_rate(conn, &existing, &updated_transaction, &persisted)
                    .map_err(crate::errors::StorageError::from)?;
                crate::valuations::upsert_transaction_valuation(conn, &persisted)
                    .map_err(crate::errors::StorageError::from)?;

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
                Ok(CommittedOutcome::with_alert_outcomes(
                    transaction_detail(conn, persisted)
                        .map_err(crate::errors::StorageError::from)?,
                    alerts,
                ))
            },
        )
        .await?;
    publish_created_alerts(publisher.as_ref(), &outcome);
    Ok(outcome.value)
}
