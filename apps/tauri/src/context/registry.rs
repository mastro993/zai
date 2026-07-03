use std::sync::Arc;

use zai_core::features::{
    transaction_categories::transaction_categories_traits::TransactionCategoriesServiceTrait,
    transactions::transactions_traits::TransactionsServiceTrait,
};

pub struct ServiceContext {
    // Services
    pub transaction_categories_service: Arc<dyn TransactionCategoriesServiceTrait>,
    pub transactions_service: Arc<dyn TransactionsServiceTrait>,
}

impl ServiceContext {
    pub fn transaction_categories_service(&self) -> Arc<dyn TransactionCategoriesServiceTrait> {
        Arc::clone(&self.transaction_categories_service)
    }
    pub fn transactions_service(&self) -> Arc<dyn TransactionsServiceTrait> {
        Arc::clone(&self.transactions_service)
    }
}
