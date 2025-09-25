use async_trait::async_trait;

use super::transaction_categories_models::{NewTransactionCategory, TransactionCategory};
use crate::errors::Result;

/// Trait defining the contract for Account repository operations.
#[async_trait]
pub trait TransactionCategoriesRepositoryTrait: Send + Sync {
    fn get_category(&self, id: &str) -> Result<TransactionCategory>;
    fn get_all_categories(&self) -> Result<Vec<TransactionCategory>>;
    fn get_children(&self, parent_id: &str) -> Result<Vec<TransactionCategory>>;
    async fn create_category(&self, new_category: NewTransactionCategory) -> Result<TransactionCategory>;
    async fn update_category(&self, category: TransactionCategory) -> Result<TransactionCategory>;
    async fn delete_category(&self, id: &str) -> Result<TransactionCategory>;
}