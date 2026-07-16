use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::transaction_categories::models::{
    NewTransactionCategory, TransactionCategory,
};

use super::models::TransactionCategoryRow;
use super::read::category_from_row;
use super::repository::TransactionCategoriesRepository;
use crate::errors::IntoStorage;
use crate::schema::transaction_categories;

pub(super) async fn import_categories(
    repository: &TransactionCategoriesRepository,
    new_categories: Vec<NewTransactionCategory>,
) -> Result<Vec<TransactionCategory>> {
    if new_categories.is_empty() {
        return Ok(Vec::new());
    }

    repository
        .writer
        .exec(
            move |conn: &mut SqliteConnection| -> crate::errors::Result<Vec<TransactionCategory>> {
                let categories: Vec<TransactionCategoryRow> =
                    new_categories.iter().map(|c| c.clone().into()).collect();

                diesel::insert_into(transaction_categories::table)
                    .values(&categories)
                    .execute(conn)
                    .into_storage()?;

                let ids = categories
                    .iter()
                    .map(|c| c.id.clone())
                    .collect::<Vec<String>>();

                let inserted = transaction_categories::table
                    .filter(transaction_categories::id.eq_any(&ids))
                    .load::<TransactionCategoryRow>(conn)
                    .into_storage()?;

                let inserted = inserted
                    .into_iter()
                    .map(category_from_row)
                    .collect::<crate::errors::Result<Vec<_>>>()?;
                Ok(inserted)
            },
        )
        .await
}
