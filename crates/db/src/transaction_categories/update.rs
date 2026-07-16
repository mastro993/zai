use super::models::{TransactionCategoryRow, TransactionCategoryRowUpdate};
use super::row_mapping::category_from_rows;
use super::validation::{
    apply_resolved_parent_to_changeset, map_category_unique_violation, validate_category_update,
};
use crate::budgets::alerts::{emit_budget_transition_alerts, snapshot_budgets_by_ids};
use crate::budgets::category_impact::affected_budgets_for_update;
use crate::budgets::projection::{rebuild_budget_projections, refresh_active_budget_projections};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::transaction_categories;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::domain_alerts::CommittedOutcome;
use zai_core::features::transaction_categories::models::{
    TransactionCategory, TransactionCategoryUpdate,
};

pub(super) fn update_category(
    conn: &mut SqliteConnection,
    updated_category: TransactionCategoryUpdate,
    now: NaiveDateTime,
) -> crate::errors::Result<CommittedOutcome<TransactionCategory>> {
    let category_id = updated_category.id.clone();
    let mut changeset: TransactionCategoryRowUpdate = updated_category.clone().into();
    changeset.updated_at = now;

    let existing = transaction_categories::table
        .find(&category_id)
        .first::<TransactionCategoryRow>(conn)
        .into_storage()?;
    let resolved_parent = validate_category_update(
        conn,
        &category_id,
        changeset.parent_id.as_deref(),
        &changeset.name,
    )?;
    apply_resolved_parent_to_changeset(&mut changeset, resolved_parent);
    let structural_change =
        existing.parent_id != changeset.parent_id || existing.role != changeset.role;
    let affected_budgets = if structural_change {
        refresh_active_budget_projections(conn, now)?;
        affected_budgets_for_update(
            conn,
            &category_id,
            existing.parent_id.as_deref(),
            changeset.parent_id.as_deref(),
            existing.role.parse().map_err(|_| {
                StorageError::CoreError(Error::Repository("Invalid category role".to_string()))
            })?,
            changeset.role.parse().map_err(|_| {
                StorageError::CoreError(Error::Repository("Invalid category role".to_string()))
            })?,
            now,
        )?
    } else {
        Vec::new()
    };

    if structural_change && !affected_budgets.is_empty() && !updated_category.confirm_budget_impact
    {
        return Err(StorageError::CoreError(
            Error::BudgetImpactConfirmationRequired { affected_budgets },
        ));
    }

    let affected_ids = affected_budgets
        .iter()
        .map(|budget| budget.id.clone())
        .collect::<Vec<_>>();
    let before = snapshot_budgets_by_ids(conn, &affected_ids, now)?;

    diesel::update(transaction_categories::table.find(&category_id))
        .set(&changeset)
        .execute(conn)
        .into_storage()
        .map_err(map_category_unique_violation)?;

    if changeset.parent_id.is_none() {
        diesel::update(
            transaction_categories::table
                .filter(transaction_categories::parent_id.eq(&category_id))
                .filter(transaction_categories::deleted_at.is_null()),
        )
        .set((
            transaction_categories::role.eq(&changeset.role),
            transaction_categories::updated_at.eq(changeset.updated_at),
        ))
        .execute(conn)
        .into_storage()?;
    }

    let parent_categories = diesel::alias!(transaction_categories as parent_categories);

    let (category_row, parent_row) = transaction_categories::table
        .left_join(
            parent_categories.on(transaction_categories::parent_id.eq(parent_categories
                .field(transaction_categories::id)
                .nullable())),
        )
        .filter(transaction_categories::id.eq(&category_id))
        .first::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
        .into_storage()?;

    let category = category_from_rows(category_row, parent_row)?;
    if structural_change {
        rebuild_budget_projections(conn, &affected_ids)?;
    }
    let after = snapshot_budgets_by_ids(conn, &affected_ids, now)?;
    let alerts = if structural_change {
        emit_budget_transition_alerts(conn, BudgetAlertMode::Transition, &before, &after)?
    } else {
        Vec::new()
    };
    Ok(CommittedOutcome::with_alert_outcomes(category, alerts))
}
