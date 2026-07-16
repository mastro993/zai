use std::sync::Arc;

use diesel::prelude::*;
use zai_core::Result;
use zai_core::features::transaction_categories::models::TransactionCategory;

use super::models::TransactionCategoryRow;
use super::repository::TransactionCategoriesRepository;
use crate::blocking::run_blocking;
use crate::connection::get_connection;
use crate::errors::{IntoCore, StorageError};
use crate::schema::transaction_categories;

pub(super) fn category_from_row(
    row: TransactionCategoryRow,
) -> crate::errors::Result<TransactionCategory> {
    row.try_into().map_err(StorageError::CoreError)
}

pub(super) fn category_from_rows(
    row: TransactionCategoryRow,
    parent_row: Option<TransactionCategoryRow>,
) -> crate::errors::Result<TransactionCategory> {
    let mut category = category_from_row(row)?;
    if let Some(parent_row) = parent_row {
        let parent = category_from_row(parent_row)?;
        category.role = parent.role;
        category.parent = Some(Box::new(parent));
    }
    Ok(category)
}

pub(super) async fn get_categories(
    repository: &TransactionCategoriesRepository,
    parent_id: Option<&str>,
) -> Result<Vec<TransactionCategory>> {
    let pool = Arc::clone(&repository.pool);
    let parent_id = parent_id.map(str::to_owned);
    run_blocking(move || {
        let conn = &mut get_connection(&pool)?;

        let parent_categories = diesel::alias!(transaction_categories as parent_categories);
        let mut query = transaction_categories::table
            .left_join(
                parent_categories.on(transaction_categories::parent_id.eq(parent_categories
                    .field(transaction_categories::id)
                    .nullable())),
            )
            .filter(transaction_categories::deleted_at.is_null())
            .into_boxed();

        if let Some(ref pid) = parent_id {
            query = query.filter(transaction_categories::parent_id.eq(pid));
        }

        let results = query
            .load::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
            .into_core()?;

        let categories = results
            .into_iter()
            .map(|(row, parent_row)| category_from_rows(row, parent_row))
            .collect::<crate::errors::Result<Vec<_>>>()?;

        Ok(categories)
    })
    .await
}

pub(super) async fn get_category(
    repository: &TransactionCategoriesRepository,
    id: &str,
) -> Result<TransactionCategory> {
    let pool = Arc::clone(&repository.pool);
    let id = id.to_owned();
    run_blocking(move || {
        let conn = &mut get_connection(&pool)?;

        let parent_categories = diesel::alias!(transaction_categories as parent_categories);

        let (category_row, parent_row) = transaction_categories::table
            .left_join(
                parent_categories.on(transaction_categories::parent_id.eq(parent_categories
                    .field(transaction_categories::id)
                    .nullable())),
            )
            .filter(transaction_categories::id.eq(&id))
            .filter(transaction_categories::deleted_at.is_null())
            .first::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
            .into_core()?;

        category_from_rows(category_row, parent_row).map_err(StorageError::into)
    })
    .await
}

pub(super) async fn category_has_children(
    repository: &TransactionCategoriesRepository,
    id: &str,
) -> Result<bool> {
    let pool = Arc::clone(&repository.pool);
    let id = id.to_owned();
    run_blocking(move || {
        let conn = &mut get_connection(&pool)?;

        let child_count = transaction_categories::table
            .filter(transaction_categories::parent_id.eq(id))
            .filter(transaction_categories::deleted_at.is_null())
            .count()
            .get_result::<i64>(conn)
            .into_core()?;

        Ok(child_count > 0)
    })
    .await
}

pub(super) async fn sibling_name_exists(
    repository: &TransactionCategoriesRepository,
    parent_id: Option<&str>,
    name: &str,
    excluded_id: Option<&str>,
) -> Result<bool> {
    let pool = Arc::clone(&repository.pool);
    let parent_id = parent_id.map(str::to_owned);
    let name = name.to_owned();
    let excluded_id = excluded_id.map(str::to_owned);
    run_blocking(move || {
        let conn = &mut get_connection(&pool)?;
        let normalized_name = name.trim().to_lowercase();

        let mut query = transaction_categories::table
            .filter(transaction_categories::deleted_at.is_null())
            .into_boxed();

        query = match parent_id.as_deref() {
            Some(parent_id) => query.filter(transaction_categories::parent_id.eq(parent_id)),
            None => query.filter(transaction_categories::parent_id.is_null()),
        };

        if let Some(excluded_id) = excluded_id.as_deref() {
            query = query.filter(transaction_categories::id.ne(excluded_id));
        }

        let sibling_names = query
            .select(transaction_categories::name)
            .load::<String>(conn)
            .into_core()?;

        Ok(sibling_names
            .iter()
            .any(|sibling_name| sibling_name.trim().to_lowercase() == normalized_name))
    })
    .await
}
