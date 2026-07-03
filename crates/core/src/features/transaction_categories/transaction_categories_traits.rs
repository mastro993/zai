use super::transaction_categories_models::NewTransactionCategory;
use crate::errors::Result;
use crate::features::transaction_categories::transaction_categories_models::*;
use async_trait::async_trait;

#[async_trait]
pub trait TransactionCategoriesServiceTrait: Send + Sync {
    fn get_categories(&self, parent_id: Option<&str>) -> Result<Vec<TransactionCategory>>;
    fn get_category(&self, category_id: &str) -> Result<TransactionCategory>;

    async fn create_category(
        &self,
        activity: NewTransactionCategory,
    ) -> Result<TransactionCategory>;
    async fn update_category(
        &self,
        activity: TransactionCategoryUpdate,
    ) -> Result<TransactionCategory>;
    async fn delete_categories(&self, ids: Vec<&str>) -> Result<Vec<TransactionCategory>>;

    async fn import_categories(
        &self,
        categories: Vec<NewTransactionCategory>,
    ) -> Result<Vec<TransactionCategory>>;
}

#[async_trait]
pub trait TransactionCategoriesRepositoryTrait: Send + Sync {
    fn get_categories(&self, parent_id: Option<&str>) -> Result<Vec<TransactionCategory>>;
    fn get_category(&self, id: &str) -> Result<TransactionCategory>;

    async fn create_category(
        &self,
        new_category: NewTransactionCategory,
    ) -> Result<TransactionCategory>;
    async fn update_category(
        &self,
        updated_category: TransactionCategoryUpdate,
    ) -> Result<TransactionCategory>;
    async fn delete_categories(&self, ids: Vec<&str>) -> Result<Vec<TransactionCategory>>;

    async fn import_categories(
        &self,
        categories: Vec<NewTransactionCategory>,
    ) -> Result<Vec<TransactionCategory>>;
}
