use super::models::TransactionCategoryRow;
use crate::errors::StorageError;
use zai_core::features::transaction_categories::models::TransactionCategory;

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
