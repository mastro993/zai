use std::sync::Arc;
use zai_db::repositories::transaction_categories::TransactionCategoriesRepositoryTrait;
use crate::services::transaction_categories::transaction_categories_traits::TransactionCategoriesServiceTrait;
use crate::services::transaction_categories::transaction_category_models::TransactionCategory;
use crate::errors::Result;
pub struct TransactionCategoriesService {
    repository: Arc<dyn TransactionCategoriesRepositoryTrait>,
}

impl TransactionCategoriesService {
    pub fn new(
        repository: Arc<dyn TransactionCategoriesRepositoryTrait>,
    ) -> Self {
        Self {
            repository,
        }
    }
}

#[async_trait::async_trait]
impl TransactionCategoriesServiceTrait for TransactionCategoriesService {
    fn get_category(&self, category_id: &str) -> Result<TransactionCategory> {
        let result  = self.repository.get_category(category_id)?;
        Ok(TransactionCategory::from(result))
    }
}