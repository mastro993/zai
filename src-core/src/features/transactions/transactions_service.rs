use crate::database::pagination::PaginatedData;
use crate::database::sorting::Sort;
use crate::errors::Result;
use crate::features::transactions::transactions_models::{
    NewTransaction, Transaction, TransactionSearchFilters, TransactionUpdate,
};
use crate::features::transactions::transactions_traits::{
    TransactionsRepositoryTrait, TransactionsServiceTrait,
};
use std::sync::Arc;

pub struct TransactionsService {
    repository: Arc<dyn TransactionsRepositoryTrait>,
}

impl TransactionsService {
    pub fn new(repository: Arc<dyn TransactionsRepositoryTrait>) -> Self {
        Self { repository }
    }
}

#[async_trait::async_trait]
#[async_trait::async_trait]
impl TransactionsServiceTrait for TransactionsService {
    fn get_transactions(
        &self,
        page: i64,
        per_page: i64,
        filters: Option<TransactionSearchFilters>,
        sort: Option<Sort>,
    ) -> Result<PaginatedData<Transaction>> {
        self.repository
            .get_transactions(page, per_page, filters, sort)
    }

    fn get_transaction(&self, id: &str) -> Result<Transaction> {
        self.repository.get_transaction(id)
    }

    async fn create_transaction(&self, new_transaction: NewTransaction) -> Result<Transaction> {
        self.repository.create_transaction(new_transaction).await
    }

    async fn update_transaction(
        &self,
        transaction_update: TransactionUpdate,
    ) -> Result<Transaction> {
        self.repository.update_transaction(transaction_update).await
    }

    async fn update_transactions(
        &self,
        _transactions: Vec<TransactionUpdate>,
    ) -> Result<Transaction> {
        todo!()
    }

    async fn delete_transaction(&self, id: &str) -> Result<Transaction> {
        self.repository.delete_transaction(id).await
    }

    async fn delete_transactions(&self, ids: Vec<&str>) -> Result<Vec<Transaction>> {
        self.repository.delete_transactions(ids).await
    }

    async fn import_transactions(
        &self,
        transactions: Vec<NewTransaction>,
    ) -> Result<Vec<Transaction>> {
        self.repository.import_transactions(transactions).await
    }
}
