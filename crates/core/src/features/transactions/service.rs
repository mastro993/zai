use crate::errors::Result;
use crate::features::transaction_categories::models::{
    NewTransactionCategory, TransactionCategory,
};
use crate::features::transactions::models::{
    NewTransaction, Transaction, TransactionSearchFilters, TransactionUpdate,
};
use crate::features::transactions::traits::{
    TransactionsRepositoryTrait, TransactionsServiceTrait,
};
use crate::query::{PaginatedData, Sort};
use std::sync::Arc;
use uuid::Uuid;

pub struct TransactionsService {
    repository: Arc<dyn TransactionsRepositoryTrait>,
}

impl TransactionsService {
    pub fn new(repository: Arc<dyn TransactionsRepositoryTrait>) -> Self {
        Self { repository }
    }
}

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

    async fn create_transaction(&self, mut new_transaction: NewTransaction) -> Result<Transaction> {
        new_transaction.validate()?;
        ensure_transaction_id(&mut new_transaction);
        self.repository.create_transaction(new_transaction).await
    }

    async fn update_transaction(
        &self,
        transaction_update: TransactionUpdate,
    ) -> Result<Transaction> {
        transaction_update.validate()?;
        self.repository.update_transaction(transaction_update).await
    }

    async fn delete_transaction(&self, id: &str) -> Result<Transaction> {
        self.repository.delete_transaction(id).await
    }

    async fn delete_transactions(&self, ids: Vec<&str>) -> Result<Vec<Transaction>> {
        self.repository.delete_transactions(ids).await
    }

    async fn import_transactions(
        &self,
        mut transactions: Vec<NewTransaction>,
    ) -> Result<Vec<Transaction>> {
        for transaction in &mut transactions {
            transaction.validate()?;
            ensure_transaction_id(transaction);
        }
        self.repository.import_transactions(transactions).await
    }

    async fn import_transactions_with_categories(
        &self,
        categories: Vec<NewTransactionCategory>,
        mut transactions: Vec<NewTransaction>,
    ) -> Result<(Vec<TransactionCategory>, Vec<Transaction>)> {
        for transaction in &mut transactions {
            transaction.validate()?;
            ensure_transaction_id(transaction);
        }
        self.repository
            .import_transactions_with_categories(categories, transactions)
            .await
    }
}

fn ensure_transaction_id(transaction: &mut NewTransaction) {
    if transaction
        .id
        .as_deref()
        .is_none_or(|id| id.trim().is_empty())
    {
        transaction.id = Some(Uuid::new_v4().to_string());
    }
}
