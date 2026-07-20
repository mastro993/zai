use std::sync::Arc;

use async_trait::async_trait;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::DomainAlertEventPublisher;
use zai_core::features::transaction_categories::models::{
    NewTransactionCategory, TransactionCategory,
};
use zai_core::features::transactions::models::{
    DuplicateKeyCandidate, NewTransaction, Transaction, TransactionSearchFilters, TransactionUpdate,
};
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;
use zai_core::query::{PaginatedData, Sort};

use super::{delete, import, mutations, read};
use crate::connection::DbPool;
use crate::write_actor::WriteHandle;

pub struct TransactionsRepository {
    pub(super) pool: Arc<DbPool>,
    pub(super) writer: WriteHandle,
    pub(super) clock: Arc<dyn CalendarClock>,
    pub(super) alert_publisher: Arc<dyn DomainAlertEventPublisher>,
    pub(super) zone_provider: Arc<dyn zai_core::time::DeviceZoneProvider>,
}

impl TransactionsRepository {
    #[cfg(test)]
    pub(crate) fn new(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
    ) -> Self {
        Self::new_with_clock_and_publisher(
            pool,
            writer,
            Arc::new(zai_core::features::budgets::traits::LocalCalendarClock),
            zai_core::features::domain_alerts::DomainAlertEventBus::new(),
        )
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn new_with_clock(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
        clock: Arc<dyn CalendarClock>,
    ) -> Self {
        Self::new_with_clock_and_publisher(
            pool,
            writer,
            clock,
            zai_core::features::domain_alerts::DomainAlertEventBus::new(),
        )
    }

    pub(crate) fn new_with_clock_and_publisher(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
        clock: Arc<dyn CalendarClock>,
        alert_publisher: Arc<dyn DomainAlertEventPublisher>,
    ) -> Self {
        Self {
            pool,
            writer,
            clock,
            alert_publisher,
            zone_provider: Arc::new(zai_core::time::SystemDeviceZoneProvider),
        }
    }
}

#[async_trait]
impl TransactionsRepositoryTrait for TransactionsRepository {
    async fn get_transactions(
        &self,
        page: i64,
        per_page: i64,
        filters: Option<TransactionSearchFilters<'_>>,
        sort: Option<Sort>,
    ) -> Result<PaginatedData<Transaction>> {
        read::get_transactions(self, page, per_page, filters, sort).await
    }

    async fn get_transaction(&self, id: &str) -> Result<Transaction> {
        read::get_transaction(self, id).await
    }

    async fn get_filtered_transaction_ids(
        &self,
        filters: Option<TransactionSearchFilters<'_>>,
        sort: Option<Sort>,
    ) -> Result<Vec<String>> {
        read::get_filtered_transaction_ids(self, filters, sort).await
    }

    async fn export_transactions_csv(
        &self,
        filters: Option<TransactionSearchFilters<'_>>,
        transaction_ids: Option<Vec<String>>,
    ) -> Result<String> {
        read::export_transactions_csv(self, filters, transaction_ids).await
    }

    async fn find_existing_duplicate_keys(
        &self,
        candidates: Vec<DuplicateKeyCandidate>,
    ) -> Result<Vec<String>> {
        read::find_existing_duplicate_keys(self, candidates).await
    }

    async fn create_transaction(&self, new_transaction: NewTransaction) -> Result<Transaction> {
        mutations::create_transaction(self, new_transaction).await
    }

    async fn update_transaction(
        &self,
        updated_transaction: TransactionUpdate,
    ) -> Result<Transaction> {
        mutations::update_transaction(self, updated_transaction).await
    }

    async fn delete_transaction(&self, id: &str) -> Result<Transaction> {
        delete::delete_transaction(self, id).await
    }

    async fn delete_transactions(&self, ids: Vec<&str>) -> Result<Vec<Transaction>> {
        delete::delete_transactions(self, ids).await
    }

    async fn import_transactions(
        &self,
        new_transactions: Vec<NewTransaction>,
    ) -> Result<Vec<Transaction>> {
        import::import_transactions(self, new_transactions).await
    }

    async fn import_transactions_with_categories(
        &self,
        new_categories: Vec<NewTransactionCategory>,
        new_transactions: Vec<NewTransaction>,
    ) -> Result<(Vec<TransactionCategory>, Vec<Transaction>)> {
        import::import_transactions_with_categories(self, new_categories, new_transactions).await
    }
}

#[cfg(test)]
#[path = "repository_tests/mod.rs"]
mod tests;
