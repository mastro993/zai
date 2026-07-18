use super::models::BudgetRow;
use super::timeline::load_current_or_ensure;
use crate::errors::{IntoStorage, StorageError};
use crate::schema::budgets;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::budgets::models::{Budget, BudgetLifecycleUpdate};

pub(super) fn set_budget_paused(
    conn: &mut SqliteConnection,
    id: &str,
    update: BudgetLifecycleUpdate,
    paused: bool,
    now: NaiveDateTime,
) -> crate::errors::Result<Budget> {
    update.validate().map_err(StorageError::CoreError)?;
    let stored = budgets::table
        .filter(budgets::id.eq(id))
        .filter(budgets::deleted_at.is_null())
        .first::<BudgetRow>(conn)
        .into_storage()?;
    if stored.revision != update.expected_revision {
        return Err(StorageError::CoreError(Error::RevisionConflict {
            current_revision: stored.revision,
        }));
    }

    let mut budget = load_current_or_ensure(conn, id, now)?;
    let revision = stored.revision.checked_add(1).ok_or_else(|| {
        StorageError::CoreError(Error::InvalidData("Budget revision overflow".to_string()))
    })?;
    let timestamp = chrono::Utc::now().naive_utc();
    diesel::update(
        budgets::table
            .filter(budgets::id.eq(id))
            .filter(budgets::deleted_at.is_null()),
    )
    .set((
        budgets::paused.eq(paused),
        budgets::updated_at.eq(timestamp),
        budgets::revision.eq(revision),
    ))
    .execute(conn)
    .into_storage()?;

    budget.paused = paused;
    budget.revision = revision;
    Ok(budget)
}

pub(super) fn delete_budget(
    conn: &mut SqliteConnection,
    id: &str,
    update: BudgetLifecycleUpdate,
    deleted_at: NaiveDateTime,
) -> crate::errors::Result<()> {
    update.validate().map_err(StorageError::CoreError)?;
    let stored = budgets::table
        .filter(budgets::id.eq(id))
        .first::<BudgetRow>(conn)
        .into_storage()?;

    if stored.deleted_at.is_some() {
        return Ok(());
    }
    if stored.revision != update.expected_revision {
        return Err(StorageError::CoreError(Error::RevisionConflict {
            current_revision: stored.revision,
        }));
    }

    let revision = stored.revision.checked_add(1).ok_or_else(|| {
        StorageError::CoreError(Error::InvalidData("Budget revision overflow".to_string()))
    })?;
    diesel::update(
        budgets::table
            .filter(budgets::id.eq(id))
            .filter(budgets::deleted_at.is_null()),
    )
    .set((
        budgets::deleted_at.eq(deleted_at),
        budgets::updated_at.eq(deleted_at),
        budgets::revision.eq(revision),
    ))
    .execute(conn)
    .into_storage()?;
    Ok(())
}
