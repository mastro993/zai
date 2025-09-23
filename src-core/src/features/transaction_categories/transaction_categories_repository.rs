use async_trait::async_trait;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use crate::schema::transaction_category;

use crate::database::{WriteHandle, get_connection};
use crate::features::transaction_categories::transaction_categories_model::TransactionCategory;
use super::transaction_categories_traits::TransactionCategoriesRepositoryTrait;

pub struct TransactionCategoriesRepository {
    pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
    writer: WriteHandle,
}

impl TransactionCategoriesRepository {
    pub fn new(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
    ) -> Self {
        Self { pool, writer }
    }
}

#[async_trait]
impl TransactionCategoriesRepositoryTrait for TransactionCategoriesRepository {
    fn get_categories(&self) -> crate::errors::Result<Vec<TransactionCategory>> {
        let mut conn = get_connection(&self.pool)?;

        let result = transaction_category::table
            .find(asset_id)
            .first::<AssetDB>(&mut conn)?;

        Ok(result.into())
    }
}