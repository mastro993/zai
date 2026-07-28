use super::models::{TransactionCategoryRow, TransactionCategoryRowUpdate};
use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::transaction_categories;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::transaction_categories::models::CategoryRole;

pub(crate) struct ResolvedParent {
    pub id: String,
    pub role: CategoryRole,
}

fn load_active_category(conn: &mut SqliteConnection, id: &str) -> Result<TransactionCategoryRow> {
    transaction_categories::table
        .filter(transaction_categories::id.eq(id))
        .filter(transaction_categories::deleted_at.is_null())
        .first(conn)
        .into_storage()
}

fn category_has_children_conn(conn: &mut SqliteConnection, id: &str) -> Result<bool> {
    let child_count = transaction_categories::table
        .filter(transaction_categories::parent_id.eq(id))
        .filter(transaction_categories::deleted_at.is_null())
        .count()
        .get_result::<i64>(conn)
        .into_storage()?;

    Ok(child_count > 0)
}

fn sibling_name_exists_conn(
    conn: &mut SqliteConnection,
    parent_id: Option<&str>,
    name: &str,
    excluded_id: Option<&str>,
) -> Result<bool> {
    let normalized_name = name.trim().to_lowercase();

    let mut query = transaction_categories::table
        .filter(transaction_categories::deleted_at.is_null())
        .into_boxed();

    query = match parent_id {
        Some(parent_id) => query.filter(transaction_categories::parent_id.eq(parent_id)),
        None => query.filter(transaction_categories::parent_id.is_null()),
    };

    if let Some(excluded_id) = excluded_id {
        query = query.filter(transaction_categories::id.ne(excluded_id));
    }

    let sibling_names = query
        .select(transaction_categories::name)
        .load::<String>(conn)
        .into_storage()?;

    Ok(sibling_names
        .iter()
        .any(|sibling_name| sibling_name.trim().to_lowercase() == normalized_name))
}

fn ensure_unique_sibling_name(
    conn: &mut SqliteConnection,
    parent_id: Option<&str>,
    name: &str,
    excluded_id: Option<&str>,
) -> Result<()> {
    if sibling_name_exists_conn(conn, parent_id, name, excluded_id)? {
        return Err(StorageError::CoreError(Error::Conflict(
            "A category with this name already exists at the same level".to_string(),
        )));
    }

    Ok(())
}

pub(crate) fn resolve_parent(
    conn: &mut SqliteConnection,
    parent_id: Option<&str>,
) -> Result<Option<ResolvedParent>> {
    let Some(parent_id) = parent_id.filter(|id| !id.trim().is_empty()) else {
        return Ok(None);
    };

    let parent = load_active_category(conn, parent_id)?;
    if parent.parent_id.is_some() {
        return Err(StorageError::CoreError(Error::Conflict(
            "Cannot create categories deeper than 2 levels. The parent category must be a root category."
                .to_string(),
        )));
    }

    let role = parent.role.parse::<CategoryRole>().map_err(|_| {
        StorageError::CoreError(Error::Repository("Invalid category role".to_string()))
    })?;

    Ok(Some(ResolvedParent {
        id: parent.id,
        role,
    }))
}

pub(crate) fn validate_new_category(
    conn: &mut SqliteConnection,
    parent_id: Option<&str>,
    name: &str,
) -> Result<Option<ResolvedParent>> {
    let resolved_parent = resolve_parent(conn, parent_id)?;
    let sibling_parent_id = resolved_parent
        .as_ref()
        .map(|parent| parent.id.as_str())
        .or(parent_id.filter(|id| !id.trim().is_empty()));

    ensure_unique_sibling_name(conn, sibling_parent_id, name, None)?;
    Ok(resolved_parent)
}

pub(crate) fn validate_category_update(
    conn: &mut SqliteConnection,
    category_id: &str,
    parent_id: Option<&str>,
    name: &str,
) -> Result<Option<ResolvedParent>> {
    if parent_id.is_some_and(|parent_id| parent_id == category_id) {
        return Err(StorageError::CoreError(Error::InvalidData(
            "A category cannot be its own parent".to_string(),
        )));
    }

    let resolved_parent = resolve_parent(conn, parent_id)?;
    if resolved_parent.is_some() && category_has_children_conn(conn, category_id)? {
        return Err(StorageError::CoreError(Error::Conflict(
            "A category with child categories cannot become a child category".to_string(),
        )));
    }

    let sibling_parent_id = resolved_parent
        .as_ref()
        .map(|parent| parent.id.as_str())
        .or(parent_id.filter(|id| !id.trim().is_empty()));

    ensure_unique_sibling_name(conn, sibling_parent_id, name, Some(category_id))?;
    Ok(resolved_parent)
}

pub(crate) fn apply_resolved_parent(
    category: &mut TransactionCategoryRow,
    resolved_parent: Option<ResolvedParent>,
) {
    match resolved_parent {
        Some(parent) => {
            category.parent_id = Some(parent.id);
            category.role = parent.role.to_string();
        }
        None => {
            category.parent_id = None;
        }
    }
}

pub(crate) fn apply_resolved_parent_to_changeset(
    changeset: &mut TransactionCategoryRowUpdate,
    resolved_parent: Option<ResolvedParent>,
) {
    match resolved_parent {
        Some(parent) => {
            changeset.parent_id = Some(parent.id);
            changeset.role = parent.role.to_string();
        }
        None => {
            changeset.parent_id = None;
        }
    }
}

pub(crate) fn map_category_unique_violation(err: StorageError) -> StorageError {
    match err {
        StorageError::QueryFailed(diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        )) => StorageError::CoreError(Error::Conflict(
            "A category with this name already exists at the same level".to_string(),
        )),
        other => other,
    }
}
