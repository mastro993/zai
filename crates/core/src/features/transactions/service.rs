use crate::errors::Result;
use crate::features::transaction_categories::models::{
    NewTransactionCategory, TransactionCategory,
};
use crate::features::transactions::models::{
    NewTransaction, Transaction, TransactionSearchFilters, TransactionUpdate, validate_list_paging,
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
        validate_list_paging(page, per_page)?;
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
        if transactions.is_empty() {
            return Ok(Vec::new());
        }

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::errors::Error;
    use crate::features::transactions::dedup::duplicate_key;
    use chrono::NaiveDateTime;
    use std::sync::Mutex;

    #[derive(Default)]
    struct FakeRepository {
        existing_in_range: Mutex<Vec<Transaction>>,
        imported_batches: Mutex<Vec<Vec<NewTransaction>>>,
        list_calls: Mutex<u32>,
    }

    impl FakeRepository {
        fn with_existing(existing: Vec<Transaction>) -> Self {
            Self {
                existing_in_range: Mutex::new(existing),
                imported_batches: Mutex::new(Vec::new()),
                list_calls: Mutex::new(0),
            }
        }
    }

    #[async_trait::async_trait]
    impl TransactionsRepositoryTrait for FakeRepository {
        fn get_transactions(
            &self,
            _page: i64,
            _per_page: i64,
            _filters: Option<TransactionSearchFilters>,
            _sort: Option<Sort>,
        ) -> Result<PaginatedData<Transaction>> {
            *self.list_calls.lock().unwrap() += 1;
            Err(Error::InvalidData("unused in test".to_string()))
        }

        fn get_transaction(&self, _id: &str) -> Result<Transaction> {
            Err(Error::InvalidData("unused in test".to_string()))
        }

        async fn create_transaction(
            &self,
            _new_transaction: NewTransaction,
        ) -> Result<Transaction> {
            Err(Error::InvalidData("unused in test".to_string()))
        }

        async fn update_transaction(
            &self,
            _updated_transaction: TransactionUpdate,
        ) -> Result<Transaction> {
            Err(Error::InvalidData("unused in test".to_string()))
        }

        async fn delete_transaction(&self, _id: &str) -> Result<Transaction> {
            Err(Error::InvalidData("unused in test".to_string()))
        }

        async fn delete_transactions(&self, _ids: Vec<&str>) -> Result<Vec<Transaction>> {
            Err(Error::InvalidData("unused in test".to_string()))
        }

        async fn import_transactions(
            &self,
            transactions: Vec<NewTransaction>,
        ) -> Result<Vec<Transaction>> {
            self.imported_batches
                .lock()
                .unwrap()
                .push(transactions.clone());

            let mut existing = self.existing_in_range.lock().unwrap();
            let mut seen_keys = existing
                .iter()
                .map(|transaction| {
                    duplicate_key(
                        transaction.transaction_date,
                        transaction.amount,
                        transaction.description.as_deref(),
                    )
                })
                .collect::<std::collections::HashSet<String>>();

            let mut imported = Vec::new();
            for transaction in transactions {
                let key = duplicate_key(
                    transaction.transaction_date,
                    transaction.amount,
                    transaction.description.as_deref(),
                );
                if seen_keys.insert(key) {
                    let row = Transaction {
                        id: transaction.id.unwrap_or_default(),
                        description: transaction.description,
                        amount: transaction.amount,
                        transaction_date: transaction.transaction_date,
                        transaction_type: transaction.transaction_type,
                        transaction_category_id: transaction.transaction_category_id,
                        notes: transaction.notes,
                    };
                    existing.push(row.clone());
                    imported.push(row);
                }
            }

            Ok(imported)
        }

        async fn import_transactions_with_categories(
            &self,
            _categories: Vec<NewTransactionCategory>,
            transactions: Vec<NewTransaction>,
        ) -> Result<(Vec<TransactionCategory>, Vec<Transaction>)> {
            let imported = self.import_transactions(transactions).await?;
            Ok((Vec::new(), imported))
        }
    }

    #[tokio::test]
    async fn import_transactions_skips_duplicates_on_second_import() {
        let repository = Arc::new(FakeRepository::default());
        let service = TransactionsService::new(repository);
        let payload = vec![NewTransaction {
            id: None,
            description: Some(" Groceries ".to_string()),
            amount: 1250,
            transaction_date: parse_datetime("2026-01-15T08:30:00"),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        }];

        let first = service.import_transactions(payload.clone()).await.unwrap();
        let second = service.import_transactions(payload).await.unwrap();

        assert_eq!(first.len(), 1);
        assert_eq!(second.len(), 0);
    }

    #[tokio::test]
    async fn import_transactions_skips_duplicates_against_existing_same_day_key() {
        let existing = vec![Transaction {
            id: "existing".to_string(),
            description: Some("groceries".to_string()),
            amount: 1250,
            transaction_date: parse_datetime("2026-01-15T20:45:00"),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        }];
        let repository = Arc::new(FakeRepository::with_existing(existing));
        let service = TransactionsService::new(repository);

        let imported = service
            .import_transactions(vec![NewTransaction {
                id: None,
                description: Some(" Groceries ".to_string()),
                amount: 1250,
                transaction_date: parse_datetime("2026-01-15T08:30:00"),
                transaction_type: "expense".to_string(),
                transaction_category_id: None,
                notes: None,
            }])
            .await
            .unwrap();

        assert_eq!(imported.len(), 0);
    }

    fn parse_datetime(value: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S").expect("valid datetime")
    }

    #[test]
    fn get_transactions_rejects_invalid_paging_before_repository() {
        let repository = Arc::new(FakeRepository::default());
        let service = TransactionsService::new(repository.clone());

        let result = service.get_transactions(0, 50, None, None);

        assert!(matches!(result, Err(Error::InvalidData(_))));
        assert_eq!(*repository.list_calls.lock().unwrap(), 0);
    }
}
