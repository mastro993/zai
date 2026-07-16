use super::bulk_ops;
use super::delete;
use super::import;
use super::models::TransactionRow;
use super::mutation;
use super::query::{
    apply_transaction_filters, apply_transaction_sort, count_transactions, transactions_base_query,
};
use crate::blocking::run_blocking;
use crate::connection::{DbPool, get_connection};
use crate::errors::IntoCore;
use crate::pagination::{Paginate, total_pages};
use crate::schema::transactions;
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::{DomainAlertEventPublisher, publish_created_alerts};
use zai_core::features::transaction_categories::models::{
    NewTransactionCategory, TransactionCategory,
};
use zai_core::features::transactions::models::{
    DuplicateKeyCandidate, NewTransaction, Transaction, TransactionSearchFilters, TransactionUpdate,
};
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;
use zai_core::query::{PaginatedData, Sort};

pub struct TransactionsRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
    clock: Arc<dyn CalendarClock>,
    alert_publisher: Arc<dyn DomainAlertEventPublisher>,
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
        }
    }

    #[cfg(test)]
    pub(crate) fn pool(&self) -> &Arc<DbPool> {
        &self.pool
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
        let pool = Arc::clone(&self.pool);
        let owned_query = filters.as_ref().and_then(|f| f.query.map(str::to_owned));
        let owned_categories =
            filters
                .as_ref()
                .and_then(|f| f.categories.as_ref())
                .map(|categories| {
                    categories
                        .iter()
                        .map(|value| (*value).to_owned())
                        .collect::<Vec<_>>()
                });
        let owned_transaction_type = filters
            .as_ref()
            .and_then(|f| f.transaction_type.map(str::to_owned));
        let start_date = filters.as_ref().and_then(|f| f.start_date);
        let end_date = filters.as_ref().and_then(|f| f.end_date);
        let has_filters = filters.is_some();

        run_blocking(move || {
            let category_refs = owned_categories
                .as_ref()
                .map(|categories| categories.iter().map(String::as_str).collect::<Vec<_>>());
            let filters = has_filters.then_some(TransactionSearchFilters {
                query: owned_query.as_deref(),
                categories: category_refs,
                transaction_type: owned_transaction_type.as_deref(),
                start_date,
                end_date,
            });
            let conn = &mut get_connection(&pool)?;

            let total = count_transactions(conn, filters.as_ref()).into_core()?;
            let total_pages = total_pages(total, per_page);

            let query = apply_transaction_sort(
                apply_transaction_filters(transactions_base_query(), filters.as_ref()),
                sort.as_ref(),
            );

            let page_rows = query
                .select(transactions::all_columns)
                .paginate(page)
                .into_core()?
                .per_page(per_page)
                .into_core()?
                .load_page::<TransactionRow>(conn)
                .into_core()?;

            let data = page_rows.into_iter().map(Transaction::from).collect();

            Ok(PaginatedData {
                data,
                page,
                per_page,
                total_pages,
            })
        })
        .await
    }

    async fn get_transaction(&self, id: &str) -> Result<Transaction> {
        let pool = Arc::clone(&self.pool);
        let id = id.to_owned();
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;

            let result = transactions::table
                .filter(transactions::deleted_at.is_null())
                .find(id)
                .first::<TransactionRow>(&mut conn)
                .into_core()?;

            Ok(result.into())
        })
        .await
    }

    async fn get_filtered_transaction_ids(
        &self,
        filters: Option<TransactionSearchFilters<'_>>,
        sort: Option<Sort>,
    ) -> Result<Vec<String>> {
        let pool = Arc::clone(&self.pool);
        let owned_query = filters.as_ref().and_then(|f| f.query.map(str::to_owned));
        let owned_categories =
            filters
                .as_ref()
                .and_then(|f| f.categories.as_ref())
                .map(|categories| {
                    categories
                        .iter()
                        .map(|value| (*value).to_owned())
                        .collect::<Vec<_>>()
                });
        let owned_transaction_type = filters
            .as_ref()
            .and_then(|f| f.transaction_type.map(str::to_owned));
        let start_date = filters.as_ref().and_then(|f| f.start_date);
        let end_date = filters.as_ref().and_then(|f| f.end_date);
        let has_filters = filters.is_some();

        run_blocking(move || {
            let category_refs = owned_categories
                .as_ref()
                .map(|categories| categories.iter().map(String::as_str).collect::<Vec<_>>());
            let filters = has_filters.then_some(TransactionSearchFilters {
                query: owned_query.as_deref(),
                categories: category_refs,
                transaction_type: owned_transaction_type.as_deref(),
                start_date,
                end_date,
            });
            let conn = &mut get_connection(&pool)?;
            bulk_ops::get_filtered_transaction_ids(conn, filters.as_ref(), sort.as_ref())
        })
        .await
    }

    async fn export_transactions_csv(
        &self,
        filters: Option<TransactionSearchFilters<'_>>,
        transaction_ids: Option<Vec<String>>,
    ) -> Result<String> {
        let pool = Arc::clone(&self.pool);
        let owned_query = filters.as_ref().and_then(|f| f.query.map(str::to_owned));
        let owned_categories =
            filters
                .as_ref()
                .and_then(|f| f.categories.as_ref())
                .map(|categories| {
                    categories
                        .iter()
                        .map(|value| (*value).to_owned())
                        .collect::<Vec<_>>()
                });
        let owned_transaction_type = filters
            .as_ref()
            .and_then(|f| f.transaction_type.map(str::to_owned));
        let start_date = filters.as_ref().and_then(|f| f.start_date);
        let end_date = filters.as_ref().and_then(|f| f.end_date);
        let has_filters = filters.is_some();

        run_blocking(move || {
            let category_refs = owned_categories
                .as_ref()
                .map(|categories| categories.iter().map(String::as_str).collect::<Vec<_>>());
            let filters = has_filters.then_some(TransactionSearchFilters {
                query: owned_query.as_deref(),
                categories: category_refs,
                transaction_type: owned_transaction_type.as_deref(),
                start_date,
                end_date,
            });
            let conn = &mut get_connection(&pool)?;
            bulk_ops::export_transactions_csv(conn, filters.as_ref(), transaction_ids.as_deref())
        })
        .await
    }

    async fn find_existing_duplicate_keys(
        &self,
        candidates: Vec<DuplicateKeyCandidate>,
    ) -> Result<Vec<String>> {
        let pool = Arc::clone(&self.pool);
        run_blocking(move || {
            let conn = &mut get_connection(&pool)?;
            bulk_ops::find_existing_duplicate_keys(conn, &candidates)
        })
        .await
    }

    async fn create_transaction(&self, new_transaction: NewTransaction) -> Result<Transaction> {
        let clock = Arc::clone(&self.clock);
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(move |conn: &mut SqliteConnection| {
                mutation::create_transaction(conn, new_transaction, clock.sample())
            })
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn update_transaction(
        &self,
        updated_transaction: TransactionUpdate,
    ) -> Result<Transaction> {
        let clock = Arc::clone(&self.clock);
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(move |conn: &mut SqliteConnection| {
                mutation::update_transaction(conn, updated_transaction, clock.sample())
            })
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn delete_transaction(&self, id: &str) -> Result<Transaction> {
        let transaction_id = id.to_owned();
        let clock = Arc::clone(&self.clock);
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(move |conn: &mut SqliteConnection| {
                delete::delete_transaction(conn, transaction_id, clock.sample())
            })
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn delete_transactions(&self, ids: Vec<&str>) -> Result<Vec<Transaction>> {
        let owned_ids = ids.iter().map(|&s| s.to_string()).collect::<Vec<String>>();
        let clock = Arc::clone(&self.clock);
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(move |conn: &mut SqliteConnection| {
                delete::delete_transactions(conn, owned_ids, clock.sample())
            })
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn import_transactions(
        &self,
        new_transactions: Vec<NewTransaction>,
    ) -> Result<Vec<Transaction>> {
        if new_transactions.is_empty() {
            return Ok(Vec::new());
        }

        let clock = Arc::clone(&self.clock);
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(move |conn: &mut SqliteConnection| {
                import::import_transactions(conn, new_transactions, clock.sample())
            })
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn import_transactions_with_categories(
        &self,
        new_categories: Vec<NewTransactionCategory>,
        new_transactions: Vec<NewTransaction>,
    ) -> Result<(Vec<TransactionCategory>, Vec<Transaction>)> {
        let clock = Arc::clone(&self.clock);
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(move |conn: &mut SqliteConnection| {
                import::import_transactions_with_categories(
                    conn,
                    new_categories,
                    new_transactions,
                    clock.sample(),
                )
            })
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }
}
