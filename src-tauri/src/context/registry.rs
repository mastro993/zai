use std::sync::Arc;

use zai_core::features::transaction_categories::transaction_categories_traits::TransactionCategoriesServiceTrait;

pub struct ServiceContext {
    // Services
    pub transaction_categories_service: Arc<dyn TransactionCategoriesServiceTrait>,
}

impl ServiceContext {
    pub fn transaction_categories_service(&self) -> Arc<dyn TransactionCategoriesServiceTrait> {
        Arc::clone(&self.transaction_categories_service)
    }
}
