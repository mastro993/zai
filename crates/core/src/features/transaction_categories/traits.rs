use super::models::{CategoryChildrenDeleteStrategy, NewTransactionCategory};
use crate::errors::Result;
use crate::features::transaction_categories::models::*;
use async_trait::async_trait;

#[async_trait]
pub trait TransactionCategoriesServiceTrait: Send + Sync {
    async fn get_categories(&self, parent_id: Option<&str>) -> Result<Vec<TransactionCategory>>;
    async fn get_category(&self, category_id: &str) -> Result<TransactionCategory>;

    async fn create_category(
        &self,
        activity: NewTransactionCategory,
    ) -> Result<TransactionCategory>;
    async fn update_category(
        &self,
        activity: TransactionCategoryUpdate,
    ) -> Result<TransactionCategory>;
    async fn preview_delete_categories(
        &self,
        ids: Vec<&str>,
        children_strategy: CategoryChildrenDeleteStrategy,
    ) -> Result<CategoryDeletionPreview>;
    async fn delete_categories(
        &self,
        ids: Vec<&str>,
        children_strategy: CategoryChildrenDeleteStrategy,
        confirm_budget_impact: bool,
    ) -> Result<Vec<TransactionCategory>>;

    async fn import_categories(
        &self,
        categories: Vec<NewTransactionCategory>,
    ) -> Result<Vec<TransactionCategory>>;
}

#[async_trait]
pub trait TransactionCategoriesRepositoryTrait: Send + Sync {
    async fn get_categories(&self, parent_id: Option<&str>) -> Result<Vec<TransactionCategory>>;
    async fn get_category(&self, id: &str) -> Result<TransactionCategory>;
    async fn category_has_children(&self, id: &str) -> Result<bool>;
    async fn sibling_name_exists(
        &self,
        parent_id: Option<&str>,
        name: &str,
        excluded_id: Option<&str>,
    ) -> Result<bool>;

    async fn create_category(
        &self,
        new_category: NewTransactionCategory,
    ) -> Result<TransactionCategory>;
    async fn update_category(
        &self,
        updated_category: TransactionCategoryUpdate,
    ) -> Result<TransactionCategory>;
    async fn preview_delete_categories(
        &self,
        ids: Vec<&str>,
        children_strategy: CategoryChildrenDeleteStrategy,
    ) -> Result<CategoryDeletionPreview>;
    async fn delete_categories(
        &self,
        ids: Vec<&str>,
        children_strategy: CategoryChildrenDeleteStrategy,
        confirm_budget_impact: bool,
    ) -> Result<Vec<TransactionCategory>>;

    async fn import_categories(
        &self,
        categories: Vec<NewTransactionCategory>,
    ) -> Result<Vec<TransactionCategory>>;
}
