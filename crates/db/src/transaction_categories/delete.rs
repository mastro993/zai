use std::sync::Arc;

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::domain_alerts::{CommittedOutcome, publish_created_alerts};
use zai_core::features::transaction_categories::models::{
    CategoryChildrenDeleteStrategy, TransactionCategory,
};
use zai_core::{Error, Result};

use super::models::TransactionCategoryRow;
use super::read::category_from_row;
use super::repository::TransactionCategoriesRepository;
use crate::budgets::alerts::{emit_budget_transition_alerts, snapshot_budgets_by_ids};
use crate::budgets::category_impact::analyze_deletion;
use crate::budgets::projection::{rebuild_budget_projections, refresh_active_budget_projections};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{transaction_categories, transactions};

pub(super) async fn delete_categories(
    repository: &TransactionCategoriesRepository,
    ids: Vec<&str>,
    children_strategy: CategoryChildrenDeleteStrategy,
    confirm_budget_impact: bool,
) -> Result<Vec<TransactionCategory>> {
    let owned_ids = ids.iter().map(|&s| s.to_string()).collect::<Vec<String>>();
    let now = repository.clock.sample();
    let publisher = Arc::clone(&repository.alert_publisher);
    let outcome = repository
        .writer
        .exec(
            move |conn: &mut SqliteConnection| -> crate::errors::Result<
                CommittedOutcome<Vec<TransactionCategory>>,
            > {
                refresh_active_budget_projections(conn, now)?;
                let impact = analyze_deletion(
                    conn,
                    &owned_ids,
                    children_strategy,
                    now,
                )?;
                if !impact.blocked_category_ids.is_empty() {
                    return Err(StorageError::CoreError(Error::CategoryDeletionBlocked {
                        category_ids: impact.blocked_category_ids,
                        affected_budgets: impact.affected_budgets,
                    }));
                }
                if !impact.affected_budgets.is_empty() && !confirm_budget_impact {
                    return Err(StorageError::CoreError(
                        Error::BudgetImpactConfirmationRequired {
                            affected_budgets: impact.affected_budgets,
                        },
                    ));
                }
                let affected_ids = impact
                    .affected_budgets
                    .iter()
                    .map(|budget| budget.id.clone())
                    .collect::<Vec<_>>();
                let before = snapshot_budgets_by_ids(conn, &affected_ids, now)?;
                let ids_to_delete = impact.ids_to_delete;

                if children_strategy == CategoryChildrenDeleteStrategy::Promote {
                    diesel::update(
                        transaction_categories::table
                            .filter(transaction_categories::parent_id.eq_any(&owned_ids))
                            .filter(transaction_categories::deleted_at.is_null()),
                    )
                    .set((
                        transaction_categories::parent_id.eq(None::<String>),
                        transaction_categories::updated_at.eq(now),
                    ))
                    .execute(conn)
                    .into_storage()?;
                }

                diesel::update(
                    transaction_categories::table
                        .filter(transaction_categories::id.eq_any(&ids_to_delete)),
                )
                .set(transaction_categories::deleted_at.eq(now))
                .execute(conn)
                .into_storage()?;

                diesel::update(
                    transactions::table.filter(
                        transactions::transaction_category_id.eq_any(&ids_to_delete),
                    ),
                )
                .set((
                    transactions::transaction_category_id.eq(None::<String>),
                    transactions::updated_at.eq(now),
                ))
                .execute(conn)
                .into_storage()?;

                let deleted = transaction_categories::table
                    .filter(transaction_categories::id.eq_any(&ids_to_delete))
                    .filter(transaction_categories::deleted_at.is_not_null())
                    .load::<TransactionCategoryRow>(conn)
                    .into_storage()?;

                let categories = deleted
                    .into_iter()
                    .map(category_from_row)
                    .collect::<crate::errors::Result<Vec<_>>>()?;
                rebuild_budget_projections(conn, &affected_ids)?;
                let after = snapshot_budgets_by_ids(conn, &affected_ids, now)?;
                let alerts = emit_budget_transition_alerts(
                    conn,
                    BudgetAlertMode::Transition,
                    &before,
                    &after,
                )?;
                Ok(CommittedOutcome::with_alert_outcomes(categories, alerts))
            },
        )
        .await?;
    publish_created_alerts(publisher.as_ref(), &outcome);
    Ok(outcome.value)
}
