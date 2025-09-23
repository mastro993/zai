use diesel::sqlite::SqliteConnection;
use async_trait::async_trait;

use super::transaction_categories_model::{TransactionCategory};
use crate::errors::Result;

/// Trait defining the contract for Account repository operations.
#[async_trait]
pub trait TransactionCategoriesRepositoryTrait: Send + Sync {
    fn get_categories(&self) -> Result<Vec<TransactionCategory>>;
}