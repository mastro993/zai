use crate::errors::Result;
use crate::services::transaction_categories::TransactionCategory;
use async_trait::async_trait;

#[async_trait]
pub trait TransactionCategoriesServiceTrait: Send + Sync {
    fn get_category(&self, category_id: &str) -> Result<TransactionCategory>;
}
