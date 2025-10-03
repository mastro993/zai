use crate::{
    errors::Result,
    features::transactions::transactions_models::{
        NewTransaction, TransactionSearchFilters, TransactionUpdate,
    },
    utils::sorting::Sort,
};
use async_trait::async_trait;

use crate::features::transactions::transactions_models::Transaction;
use crate::utils::pagination::PaginatedData;

#[async_trait]
pub trait TransactionsRepositoryTrait: Send + Sync {
    fn get_transactions(
        &self,
        page: i32,
        page_size: i32,
        filters: Option<TransactionSearchFilters>,
        sort: Option<Sort>,
    ) -> Result<PaginatedData<Transaction>>;
    fn get_transaction(&self, id: &str) -> Result<Transaction>;

    async fn create_transaction(&self, new_transaction: NewTransaction) -> Result<Transaction>;
    async fn update_transaction(
        &self,
        updated_transaction: TransactionUpdate,
    ) -> Result<Transaction>;
    async fn delete_transaction(&self, id: &str) -> Result<Transaction>;
    async fn delete_transactions(&self, ids: Vec<&str>) -> Result<Vec<Transaction>>;

    async fn import_transactions(
        &self,
        transactions: Vec<NewTransaction>,
    ) -> Result<Vec<Transaction>>;
}

#[async_trait]
pub trait TransactionsServiceTrait: Send + Sync {
    fn get_transactions(
        &self,
        page: i32,
        page_size: i32,
        filters: Option<TransactionSearchFilters>,
        sort: Option<Sort>,
    ) -> Result<Vec<Transaction>>;
    fn get_transaction(&self, id: &str) -> Result<Transaction>;

    async fn create_transaction(&self, new_category: NewTransaction) -> Result<Transaction>;
    async fn update_transaction(&self, category: TransactionUpdate) -> Result<Transaction>;
    async fn update_transactions(&self, categories: Vec<TransactionUpdate>) -> Result<Transaction>;
    async fn delete_transaction(&self, id: &str) -> Result<Transaction>;
    async fn delete_transactions(&self, ids: Vec<&str>) -> Result<Vec<Transaction>>;

    async fn import_transactions(
        &self,
        transactions: Vec<NewTransaction>,
    ) -> Result<Vec<Transaction>>;
}
