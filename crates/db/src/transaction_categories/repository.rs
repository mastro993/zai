use super::delete;
use super::models::TransactionCategoryRow;
use super::row_mapping::{category_from_row, category_from_rows};
use super::update;
use super::validation::{
    apply_resolved_parent, map_category_unique_violation, validate_new_category,
};
use crate::blocking::run_blocking;
use crate::connection::{DbPool, get_connection};
use crate::errors::{IntoCore, IntoStorage, StorageError};
use crate::schema::transaction_categories;
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
    CategoryChildrenDeleteStrategy, NewTransactionCategory, TransactionCategory,
    TransactionCategoryUpdate,
};
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;

pub struct TransactionCategoriesRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
    clock: Arc<dyn CalendarClock>,
    alert_publisher: Arc<dyn DomainAlertEventPublisher>,
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

    #[cfg(test)]
    pub(crate) fn pool(&self) -> &Arc<DbPool> {
        &self.pool
    }

    #[cfg(test)]
    pub(crate) fn writer(&self) -> &WriteHandle {
        &self.writer
    }
}

#[async_trait]
impl TransactionCategoriesRepositoryTrait for TransactionCategoriesRepository {
    async fn get_categories(&self, parent_id: Option<&str>) -> Result<Vec<TransactionCategory>> {
        let pool = Arc::clone(&self.pool);
        let parent_id = parent_id.map(str::to_owned);
        run_blocking(move || {
            let conn = &mut get_connection(&pool)?;

            let parent_categories = diesel::alias!(transaction_categories as parent_categories);
            let mut query = transaction_categories::table
                .left_join(
                    parent_categories.on(transaction_categories::parent_id.eq(parent_categories
                        .field(transaction_categories::id)
                        .nullable())),
                )
                .filter(transaction_categories::deleted_at.is_null())
                .into_boxed();

            if let Some(ref pid) = parent_id {
                query = query.filter(transaction_categories::parent_id.eq(pid));
            }

            let results = query
                .load::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
                .into_core()?;

            let categories = results
                .into_iter()
                .map(|(row, parent_row)| category_from_rows(row, parent_row))
                .collect::<crate::errors::Result<Vec<_>>>()?;

            Ok(categories)
        })
        .await
    }

    async fn get_category(&self, id: &str) -> Result<TransactionCategory> {
        let pool = Arc::clone(&self.pool);
        let id = id.to_owned();
        run_blocking(move || {
            let conn = &mut get_connection(&pool)?;

            let parent_categories = diesel::alias!(transaction_categories as parent_categories);

            let (category_row, parent_row) = transaction_categories::table
                .left_join(
                    parent_categories.on(transaction_categories::parent_id.eq(parent_categories
                        .field(transaction_categories::id)
                        .nullable())),
                )
                .filter(transaction_categories::id.eq(&id))
                .filter(transaction_categories::deleted_at.is_null())
                .first::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
                .into_core()?;

            category_from_rows(category_row, parent_row).map_err(StorageError::into)
        })
        .await
    }

    async fn category_has_children(&self, id: &str) -> Result<bool> {
        let pool = Arc::clone(&self.pool);
        let id = id.to_owned();
        run_blocking(move || {
            let conn = &mut get_connection(&pool)?;

            let child_count = transaction_categories::table
                .filter(transaction_categories::parent_id.eq(id))
                .filter(transaction_categories::deleted_at.is_null())
                .count()
                .get_result::<i64>(conn)
                .into_core()?;

            Ok(child_count > 0)
        })
        .await
    }

    async fn sibling_name_exists(
        &self,
        parent_id: Option<&str>,
        name: &str,
        excluded_id: Option<&str>,
    ) -> Result<bool> {
        let pool = Arc::clone(&self.pool);
        let parent_id = parent_id.map(str::to_owned);
        let name = name.to_owned();
        let excluded_id = excluded_id.map(str::to_owned);
        run_blocking(move || {
            let conn = &mut get_connection(&pool)?;
            let normalized_name = name.trim().to_lowercase();

            let mut query = transaction_categories::table
                .filter(transaction_categories::deleted_at.is_null())
                .into_boxed();

            query = match parent_id.as_deref() {
                Some(parent_id) => query.filter(transaction_categories::parent_id.eq(parent_id)),
                None => query.filter(transaction_categories::parent_id.is_null()),
            };

            if let Some(excluded_id) = excluded_id.as_deref() {
                query = query.filter(transaction_categories::id.ne(excluded_id));
            }

            let sibling_names = query
                .select(transaction_categories::name)
                .load::<String>(conn)
                .into_core()?;

            Ok(sibling_names
                .iter()
                .any(|sibling_name| sibling_name.trim().to_lowercase() == normalized_name))
        })
        .await
    }

    async fn create_category(
        &self,
        new_category: NewTransactionCategory,
    ) -> Result<TransactionCategory> {
        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<TransactionCategory> {
                    let mut category: TransactionCategoryRow = new_category.into();
                    let resolved_parent =
                        validate_new_category(conn, category.parent_id.as_deref(), &category.name)?;
                    apply_resolved_parent(&mut category, resolved_parent);

                    diesel::insert_into(transaction_categories::table)
                        .values(&category)
                        .execute(conn)
                        .into_storage()
                        .map_err(map_category_unique_violation)?;

                    let parent_categories =
                        diesel::alias!(transaction_categories as parent_categories);

                    let (category_row, parent_row) = transaction_categories::table
                        .left_join(
                            parent_categories.on(transaction_categories::parent_id.eq(
                                parent_categories
                                    .field(transaction_categories::id)
                                    .nullable(),
                            )),
                        )
                        .filter(transaction_categories::id.eq(&category.id))
                        .first::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
                        .into_storage()?;

                    let category = category_from_rows(category_row, parent_row)?;
                    Ok(category)
                },
            )
            .await
    }

    async fn update_category(
        &self,
        updated_category: TransactionCategoryUpdate,
    ) -> Result<TransactionCategory> {
        let now = self.clock.sample();
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(move |conn: &mut SqliteConnection| {
                update::update_category(conn, updated_category, now)
            })
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn delete_categories(
        &self,
        ids: Vec<&str>,
        children_strategy: CategoryChildrenDeleteStrategy,
        confirm_budget_impact: bool,
    ) -> Result<Vec<TransactionCategory>> {
        let owned_ids = ids.iter().map(|&s| s.to_string()).collect::<Vec<String>>();
        let now = self.clock.sample();
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(move |conn: &mut SqliteConnection| {
                delete::delete_categories(
                    conn,
                    owned_ids,
                    children_strategy,
                    confirm_budget_impact,
                    now,
                )
            })
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn import_categories(
        &self,
        new_categories: Vec<NewTransactionCategory>,
    ) -> Result<Vec<TransactionCategory>> {
        if new_categories.is_empty() {
            return Ok(Vec::new());
        }

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<Vec<TransactionCategory>> {
                    let categories: Vec<TransactionCategoryRow> =
                        new_categories.iter().map(|c| c.clone().into()).collect();

                    diesel::insert_into(transaction_categories::table)
                        .values(&categories)
                        .execute(conn)
                        .into_storage()?;

                    let ids = categories
                        .iter()
                        .map(|c| c.id.clone())
                        .collect::<Vec<String>>();

                    let inserted = transaction_categories::table
                        .filter(transaction_categories::id.eq_any(&ids))
                        .load::<TransactionCategoryRow>(conn)
                        .into_storage()?;

                    let inserted = inserted
                        .into_iter()
                        .map(category_from_row)
                        .collect::<crate::errors::Result<Vec<_>>>()?;
                    Ok(inserted)
                },
            )
            .await
    }
}
