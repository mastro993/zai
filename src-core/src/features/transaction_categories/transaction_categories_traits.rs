use super::transaction_categories_models::NewTransactionCategory;
use crate::errors::Result;
use crate::features::transaction_categories::transaction_categories_models::*;
use async_trait::async_trait;

#[async_trait]
pub trait TransactionCategoriesServiceTrait: Send + Sync {
    fn get_category(&self, category_id: &str) -> Result<TransactionCategory>;
    fn get_all_categories(&self) -> Result<Vec<TransactionCategory>>;
}

#[async_trait]
pub trait TransactionCategoriesRepositoryTrait: Send + Sync {
    fn get_category(&self, id: &str) -> Result<TransactionCategory>;
    fn get_all_categories(&self) -> Result<Vec<TransactionCategory>>;
    fn get_children(&self, parent_id: &str) -> Result<Vec<TransactionCategory>>;
    async fn create_category(
        &self,
        new_category: NewTransactionCategory,
    ) -> Result<TransactionCategory>;
    async fn update_category(&self, category: NewTransactionCategory) -> Result<TransactionCategory>;
    async fn delete_category(&self, id: &str) -> Result<usize>;
}
