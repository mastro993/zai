use super::transaction_categories_models::TransactionCategory;
use super::transaction_categories_traits::{
    TransactionCategoriesRepositoryTrait, TransactionCategoriesServiceTrait,
};
use crate::errors::Result;
use std::sync::Arc;

pub struct TransactionCategoriesService {
    repository: Arc<dyn TransactionCategoriesRepositoryTrait>,
}

impl TransactionCategoriesService {
    pub fn new(repository: Arc<dyn TransactionCategoriesRepositoryTrait>) -> Self {
        Self { repository }
    }
}

#[async_trait::async_trait]
impl TransactionCategoriesServiceTrait for TransactionCategoriesService {
    fn get_category(&self, category_id: &str) -> Result<TransactionCategory> {
        (*self.repository).get_category(category_id)
    }

    fn get_all_categories(&self) -> Result<Vec<TransactionCategory>> {
        (*self.repository).get_all_categories()
    }
}
