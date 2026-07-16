use std::sync::Arc;

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::domain_alerts::{CommittedOutcome, publish_created_alerts};
use zai_core::features::transaction_categories::models::{
    NewTransactionCategory, TransactionCategory,
};
use zai_core::features::transactions::models::{NewTransaction, Transaction};

use super::import_dedup;
use super::models::TransactionRow;
use super::repository::TransactionsRepository;
use crate::budgets::alerts::{emit_budget_transition_alerts, snapshot_active_budgets};
use crate::budgets::repair_transaction_budget_projections;
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{transaction_categories, transactions};
use crate::transaction_categories::models::TransactionCategoryRow;

fn load_existing_in_import_range(
    conn: &mut SqliteConnection,
    candidates: &[NewTransaction],
) -> crate::errors::Result<Vec<TransactionRow>> {
    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    let (range_start, range_end_exclusive) = import_dedup::import_half_open_date_range(candidates);
    transactions::table
        .filter(transactions::deleted_at.is_null())
        .filter(transactions::transaction_date.ge(range_start))
        .filter(transactions::transaction_date.lt(range_end_exclusive))
        .load::<TransactionRow>(conn)
        .into_storage()
}

fn prepare_import_rows(
    candidates: Vec<NewTransaction>,
    existing_rows: &[TransactionRow],
) -> Vec<TransactionRow> {
    import_dedup::filter_import_duplicates(candidates, existing_rows)
        .into_iter()
        .map(Into::into)
        .collect()
}

pub(super) async fn import_transactions(
    repository: &TransactionsRepository,
    new_transactions: Vec<NewTransaction>,
) -> Result<Vec<Transaction>> {
    if new_transactions.is_empty() {
        return Ok(Vec::new());
    }

    let clock = Arc::clone(&repository.clock);
    let publisher = Arc::clone(&repository.alert_publisher);
    let outcome = repository
        .writer
        .exec(
            move |conn: &mut SqliteConnection| -> crate::errors::Result<
                CommittedOutcome<Vec<Transaction>>,
            > {
                let existing_rows = load_existing_in_import_range(conn, &new_transactions)?;
                let transactions_rows =
                    prepare_import_rows(new_transactions, &existing_rows);

                if transactions_rows.is_empty() {
                    return Ok(CommittedOutcome::with_alert_outcomes(Vec::new(), vec![]));
                }

                let now = clock.sample();
                let before = snapshot_active_budgets(conn, now)?;

                diesel::insert_into(transactions::table)
                    .values(&transactions_rows)
                    .execute(conn)
                    .into_storage()?;

                let ids = transactions_rows
                    .iter()
                    .map(|transaction| transaction.id.clone())
                    .collect::<Vec<String>>();

                let inserted = transactions::table
                    .filter(transactions::id.eq_any(&ids))
                    .load::<TransactionRow>(conn)
                    .into_storage()?;

                repair_transaction_budget_projections(conn, now, &[], &transactions_rows)?;
                let after = snapshot_active_budgets(conn, now)?;
                let alerts = emit_budget_transition_alerts(
                    conn,
                    BudgetAlertMode::Transition,
                    &before,
                    &after,
                )?;
                Ok(CommittedOutcome::with_alert_outcomes(
                    inserted.into_iter().map(Transaction::from).collect(),
                    alerts,
                ))
            },
        )
        .await?;
    publish_created_alerts(publisher.as_ref(), &outcome);
    Ok(outcome.value)
}

pub(super) async fn import_transactions_with_categories(
    repository: &TransactionsRepository,
    new_categories: Vec<NewTransactionCategory>,
    new_transactions: Vec<NewTransaction>,
) -> Result<(Vec<TransactionCategory>, Vec<Transaction>)> {
    let clock = Arc::clone(&repository.clock);
    let publisher = Arc::clone(&repository.alert_publisher);
    let outcome = repository
        .writer
        .exec(
            move |conn: &mut SqliteConnection| -> crate::errors::Result<
                CommittedOutcome<(Vec<TransactionCategory>, Vec<Transaction>)>,
            > {
                let existing_rows = load_existing_in_import_range(conn, &new_transactions)?;
                let transactions_rows = prepare_import_rows(new_transactions, &existing_rows);

                let now = clock.sample();
                let before = snapshot_active_budgets(conn, now)?;
                let categories_rows: Vec<TransactionCategoryRow> =
                    new_categories.into_iter().map(Into::into).collect();

                if !categories_rows.is_empty() {
                    diesel::insert_into(transaction_categories::table)
                        .values(&categories_rows)
                        .execute(conn)
                        .into_storage()?;
                }

                if !transactions_rows.is_empty() {
                    diesel::insert_into(transactions::table)
                        .values(&transactions_rows)
                        .execute(conn)
                        .into_storage()?;
                }

                let inserted_categories = if categories_rows.is_empty() {
                    Vec::new()
                } else {
                    let category_ids = categories_rows
                        .iter()
                        .map(|category| category.id.clone())
                        .collect::<Vec<String>>();

                    transaction_categories::table
                        .filter(transaction_categories::id.eq_any(&category_ids))
                        .load::<TransactionCategoryRow>(conn)
                        .into_storage()?
                        .into_iter()
                        .map(|row| row.try_into().map_err(StorageError::CoreError))
                        .collect::<crate::errors::Result<Vec<TransactionCategory>>>()?
                };

                let inserted_transactions = if transactions_rows.is_empty() {
                    Vec::new()
                } else {
                    let transaction_ids = transactions_rows
                        .iter()
                        .map(|transaction| transaction.id.clone())
                        .collect::<Vec<String>>();

                    transactions::table
                        .filter(transactions::id.eq_any(&transaction_ids))
                        .load::<TransactionRow>(conn)
                        .into_storage()?
                        .into_iter()
                        .map(Transaction::from)
                        .collect()
                };

                if !transactions_rows.is_empty() {
                    repair_transaction_budget_projections(conn, now, &[], &transactions_rows)?;
                }
                let after = snapshot_active_budgets(conn, now)?;
                let alerts = emit_budget_transition_alerts(
                    conn,
                    BudgetAlertMode::Transition,
                    &before,
                    &after,
                )?;
                Ok(CommittedOutcome::with_alert_outcomes(
                    (inserted_categories, inserted_transactions),
                    alerts,
                ))
            },
        )
        .await?;
    publish_created_alerts(publisher.as_ref(), &outcome);
    Ok(outcome.value)
}
