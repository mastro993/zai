use std::sync::Arc;

use async_trait::async_trait;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::DomainAlertEventPublisher;
use zai_core::features::transaction_categories::models::{
    CategoryChildrenDeleteStrategy, NewTransactionCategory, TransactionCategory,
    TransactionCategoryUpdate,
};
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;

use super::{delete, import, mutations, read};
use crate::connection::DbPool;
use crate::write_actor::WriteHandle;

pub struct TransactionCategoriesRepository {
    pub(super) pool: Arc<DbPool>,
    pub(super) writer: WriteHandle,
    pub(super) clock: Arc<dyn CalendarClock>,
    pub(super) alert_publisher: Arc<dyn DomainAlertEventPublisher>,
}

impl TransactionCategoriesRepository {
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
        }
    }
}

#[async_trait]
impl TransactionCategoriesRepositoryTrait for TransactionCategoriesRepository {
    async fn get_categories(&self, parent_id: Option<&str>) -> Result<Vec<TransactionCategory>> {
        read::get_categories(self, parent_id).await
    }

    async fn get_category(&self, id: &str) -> Result<TransactionCategory> {
        read::get_category(self, id).await
    }

    async fn category_has_children(&self, id: &str) -> Result<bool> {
        read::category_has_children(self, id).await
    }

    async fn sibling_name_exists(
        &self,
        parent_id: Option<&str>,
        name: &str,
        excluded_id: Option<&str>,
    ) -> Result<bool> {
        read::sibling_name_exists(self, parent_id, name, excluded_id).await
    }

    async fn create_category(
        &self,
        new_category: NewTransactionCategory,
    ) -> Result<TransactionCategory> {
        mutations::create_category(self, new_category).await
    }

    async fn update_category(
        &self,
        updated_category: TransactionCategoryUpdate,
    ) -> Result<TransactionCategory> {
        mutations::update_category(self, updated_category).await
    }

    async fn delete_categories(
        &self,
        ids: Vec<&str>,
        children_strategy: CategoryChildrenDeleteStrategy,
        confirm_budget_impact: bool,
    ) -> Result<Vec<TransactionCategory>> {
        delete::delete_categories(self, ids, children_strategy, confirm_budget_impact).await
    }

    async fn import_categories(
        &self,
        new_categories: Vec<NewTransactionCategory>,
    ) -> Result<Vec<TransactionCategory>> {
        import::import_categories(self, new_categories).await
    }
}

#[cfg(test)]
#[path = "repository_tests/mod.rs"]
mod tests;

#[cfg(test)]
#[path = "repository_concurrency_tests.rs"]
mod repository_concurrency_tests;
