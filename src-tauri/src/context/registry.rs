use std::sync::Arc;

use zai_core::services::*;

pub struct ServiceContext {
    // Services
    pub transaction_categories_service:
        Arc<dyn transaction_categories::TransactionCategoriesServiceTrait>,
}

impl ServiceContext {

    pub fn transaction_categories_service(&self) -> Arc<dyn transaction_categories::TransactionCategoriesServiceTrait> {
        Arc::clone(&self.transaction_categories_service)
    }

}
