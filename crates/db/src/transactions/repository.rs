use super::models::TransactionRow;
use crate::budgets::projection::refresh_active_budget_projections;
use crate::connection::{DbPool, get_connection};
use crate::errors::{IntoCore, IntoStorage, StorageError};
use crate::pagination::{Paginate, total_pages};
use crate::schema::{self, transaction_categories, transactions};
use crate::transaction_categories::models::TransactionCategoryRow;
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use chrono::Local;
use diesel::expression_methods::EscapeExpressionMethods;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::transaction_categories::models::{
    NewTransactionCategory, TransactionCategory,
};
use zai_core::features::transactions::models::{
    NewTransaction, Transaction, TransactionSearchFilters, TransactionUpdate,
};
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;
use zai_core::query::{PaginatedData, Sort};

const LIKE_ESCAPE: char = '\\';

fn escape_like(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

type TransactionBoxedQuery = diesel::helper_types::IntoBoxed<
    'static,
    diesel::helper_types::Filter<
        schema::transactions::table,
        diesel::dsl::IsNull<schema::transactions::columns::deleted_at>,
    >,
    diesel::sqlite::Sqlite,
>;

fn transactions_base_query() -> TransactionBoxedQuery {
    transactions::table
        .filter(transactions::deleted_at.is_null())
        .into_boxed()
}

fn apply_transaction_filters(
    mut query: TransactionBoxedQuery,
    filters: Option<&TransactionSearchFilters>,
) -> TransactionBoxedQuery {
    if let Some(filters) = filters {
        if let Some(query_filter) = &filters.query {
            let query_pattern = format!("%{}%", escape_like(query_filter));
            query = query.filter(
                transactions::description
                    .like(query_pattern.clone())
                    .escape(LIKE_ESCAPE)
                    .or(transactions::notes.like(query_pattern).escape(LIKE_ESCAPE)),
            );
        }
        if let Some(categories_filter) = &filters.categories {
            if categories_filter.is_empty() {
                query = query.filter(transactions::transaction_category_id.is_null());
            } else {
                let category_ids = categories_filter
                    .iter()
                    .map(|category_id| (*category_id).to_string())
                    .collect::<Vec<_>>();
                query = query.filter(transactions::transaction_category_id.eq_any(category_ids));
            }
        }
        if let Some(type_filter) = filters.transaction_type {
            query = query.filter(transactions::transaction_type.eq(type_filter.to_string()));
        }
        if let Some(start_date_filter) = filters.start_date {
            query = query.filter(transactions::transaction_date.ge(start_date_filter));
        }
        if let Some(end_date_filter) = filters.end_date {
            query = query.filter(transactions::transaction_date.le(end_date_filter));
        }
    }
    query
}

fn apply_transaction_sort(
    mut query: TransactionBoxedQuery,
    sort: Option<&Sort>,
) -> TransactionBoxedQuery {
    if let Some(sort) = sort {
        match sort.field.as_str() {
            "description" => {
                if sort.desc {
                    query = query.order((transactions::description.desc(),));
                } else {
                    query = query.order((transactions::description.asc(),));
                }
            }
            "type" => {
                if sort.desc {
                    query = query.order((transactions::transaction_type.desc(),));
                } else {
                    query = query.order((transactions::transaction_type.asc(),));
                }
            }
            "amount" => {
                if sort.desc {
                    query = query.order((transactions::amount.desc(),));
                } else {
                    query = query.order((transactions::amount.asc(),));
                }
            }
            "date" => {
                if sort.desc {
                    query = query.order((
                        transactions::transaction_date.desc(),
                        transactions::created_at.asc(),
                    ));
                } else {
                    query = query.order((
                        transactions::transaction_date.asc(),
                        transactions::created_at.asc(),
                    ));
                }
            }
            _ => {
                query = query.order((
                    transactions::transaction_date.desc(),
                    transactions::created_at.asc(),
                ))
            }
        }
    } else {
        query = query.order((
            transactions::transaction_date.desc(),
            transactions::created_at.asc(),
        ));
    }
    query
}

fn count_transactions(
    conn: &mut diesel::SqliteConnection,
    filters: Option<&TransactionSearchFilters>,
) -> diesel::QueryResult<i64> {
    apply_transaction_filters(transactions_base_query(), filters)
        .count()
        .get_result(conn)
}

pub struct TransactionsRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
    clock: Arc<dyn CalendarClock>,
}

impl TransactionsRepository {
    #[cfg(test)]
    pub(crate) fn new(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
    ) -> Self {
        Self::new_with_clock(
            pool,
            writer,
            Arc::new(zai_core::features::budgets::traits::LocalCalendarClock),
        )
    }

    pub(crate) fn new_with_clock(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
        clock: Arc<dyn CalendarClock>,
    ) -> Self {
        Self {
            pool,
            writer,
            clock,
        }
    }
}

#[async_trait]
impl TransactionsRepositoryTrait for TransactionsRepository {
    fn get_transactions(
        &self,
        page: i64,
        per_page: i64,
        filters: Option<TransactionSearchFilters>,
        sort: Option<Sort>,
    ) -> Result<PaginatedData<Transaction>> {
        let conn = &mut get_connection(&self.pool)?;

        let total = count_transactions(conn, filters.as_ref()).into_core()?;
        let total_pages = total_pages(total, per_page);

        let query = apply_transaction_sort(
            apply_transaction_filters(transactions_base_query(), filters.as_ref()),
            sort.as_ref(),
        );

        let page_rows = query
            .select(transactions::all_columns)
            .paginate(page)
            .per_page(per_page)
            .load_page::<TransactionRow>(conn)
            .into_core()?;

        let data = page_rows.into_iter().map(Transaction::from).collect();

        Ok(PaginatedData {
            data,
            page,
            per_page,
            total_pages,
        })
    }

    fn get_transaction(&self, id: &str) -> Result<Transaction> {
        let mut conn = get_connection(&self.pool)?;

        let result = transactions::table
            .filter(transactions::deleted_at.is_null())
            .find(id)
            .first::<TransactionRow>(&mut conn)
            .into_core()?;

        Ok(result.into())
    }

    async fn create_transaction(&self, new_transaction: NewTransaction) -> Result<Transaction> {
        let clock = Arc::clone(&self.clock);
        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<Transaction> {
                    let transaction: TransactionRow = new_transaction.into();
                    let transaction_id = transaction.id.clone();

                    diesel::insert_into(transactions::table)
                        .values(&transaction)
                        .execute(conn)
                        .into_storage()?;

                    let inserted = transactions::table
                        .filter(transactions::id.eq(&transaction_id))
                        .first::<TransactionRow>(conn)
                        .into_storage()?;

                    refresh_active_budget_projections(conn, clock.sample())?;

                    Ok(inserted.into())
                },
            )
            .await
    }

    async fn update_transaction(
        &self,
        updated_transaction: TransactionUpdate,
    ) -> Result<Transaction> {
        let clock = Arc::clone(&self.clock);
        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<Transaction> {
                    let mut transaction: TransactionRow = updated_transaction.into();

                    let existing = transactions::table
                        .find(&transaction.id)
                        .first::<TransactionRow>(conn)
                        .into_storage()?;

                    transaction.created_at = existing.created_at;
                    transaction.updated_at = chrono::Utc::now().naive_utc();

                    diesel::update(transactions::table.find(&transaction.id))
                        .set(&transaction)
                        .execute(conn)
                        .into_storage()?;

                    refresh_active_budget_projections(conn, clock.sample())?;

                    Ok(transaction.into())
                },
            )
            .await
    }

    async fn delete_transaction(&self, id: &str) -> Result<Transaction> {
        let transaction_id = id.to_owned();
        let clock = Arc::clone(&self.clock);

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<Transaction> {
                    let now = Local::now().naive_utc();

                    diesel::update(transactions::table.find(&transaction_id))
                        .set(transactions::deleted_at.eq(now))
                        .execute(conn)
                        .into_storage()?;

                    let deleted = transactions::table
                        .find(&transaction_id)
                        .filter(transactions::deleted_at.is_not_null())
                        .first::<TransactionRow>(conn)
                        .into_storage()?;

                    refresh_active_budget_projections(conn, clock.sample())?;

                    Ok(deleted.into())
                },
            )
            .await
    }

    async fn delete_transactions(&self, ids: Vec<&str>) -> Result<Vec<Transaction>> {
        let owned_ids = ids.iter().map(|&s| s.to_string()).collect::<Vec<String>>();
        let clock = Arc::clone(&self.clock);

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<Vec<Transaction>> {
                    let now = Local::now().naive_utc();

                    diesel::update(transactions::table.filter(transactions::id.eq_any(&owned_ids)))
                        .set(transactions::deleted_at.eq(now))
                        .execute(conn)
                        .into_storage()?;

                    let deleted = transactions::table
                        .filter(transactions::id.eq_any(&owned_ids))
                        .filter(transactions::deleted_at.is_not_null())
                        .load::<TransactionRow>(conn)
                        .into_storage()?;

                    let deleted_transactions: Vec<Transaction> =
                        deleted.into_iter().map(Transaction::from).collect();
                    refresh_active_budget_projections(conn, clock.sample())?;
                    Ok(deleted_transactions)
                },
            )
            .await
    }

    fn find_transactions_in_date_range(
        &self,
        start_date: chrono::NaiveDateTime,
        end_date: chrono::NaiveDateTime,
    ) -> Result<Vec<Transaction>> {
        let conn = &mut get_connection(&self.pool)?;
        let rows = transactions::table
            .filter(transactions::deleted_at.is_null())
            .filter(transactions::transaction_date.ge(start_date))
            .filter(transactions::transaction_date.le(end_date))
            .load::<TransactionRow>(conn)
            .into_core()?;

        Ok(rows.into_iter().map(Transaction::from).collect())
    }

    async fn import_transactions(
        &self,
        new_transactions: Vec<NewTransaction>,
    ) -> Result<Vec<Transaction>> {
        if new_transactions.is_empty() {
            return Ok(Vec::new());
        }

        let clock = Arc::clone(&self.clock);
        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<Vec<Transaction>> {
                    let transactions_rows: Vec<TransactionRow> =
                        new_transactions.iter().map(|c| c.clone().into()).collect();

                    diesel::insert_into(transactions::table)
                        .values(&transactions_rows)
                        .execute(conn)
                        .into_storage()?;

                    let ids = transactions_rows
                        .iter()
                        .map(|c| c.id.clone())
                        .collect::<Vec<String>>();

                    let inserted = transactions::table
                        .filter(transactions::id.eq_any(&ids))
                        .load::<TransactionRow>(conn)
                        .into_storage()?;

                    refresh_active_budget_projections(conn, clock.sample())?;

                    Ok(inserted.into_iter().map(Transaction::from).collect())
                },
            )
            .await
    }

    async fn import_transactions_with_categories(
        &self,
        new_categories: Vec<NewTransactionCategory>,
        new_transactions: Vec<NewTransaction>,
    ) -> Result<(Vec<TransactionCategory>, Vec<Transaction>)> {
        let clock = Arc::clone(&self.clock);
        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<_> {
                    let categories_rows: Vec<TransactionCategoryRow> =
                        new_categories.into_iter().map(Into::into).collect();
                    let transactions_rows: Vec<TransactionRow> =
                        new_transactions.into_iter().map(Into::into).collect();

                    if !categories_rows.is_empty() {
                        diesel::insert_into(transaction_categories::table)
                            .values(&categories_rows)
                            .execute(conn)
                            .into_storage()?;
                    }

                    if !transactions_rows.is_empty() {
                        diesel::insert_into(transactions::table)
                            .values(&transactions_rows)
                            .execute(conn)
                            .into_storage()?;
                    }

                    let inserted_categories = if categories_rows.is_empty() {
                        Vec::new()
                    } else {
                        let category_ids = categories_rows
                            .iter()
                            .map(|category| category.id.clone())
                            .collect::<Vec<String>>();

                        transaction_categories::table
                            .filter(transaction_categories::id.eq_any(&category_ids))
                            .load::<TransactionCategoryRow>(conn)
                            .into_storage()?
                            .into_iter()
                            .map(|row| row.try_into().map_err(StorageError::CoreError))
                            .collect::<crate::errors::Result<Vec<TransactionCategory>>>()?
                    };

                    let inserted_transactions = if transactions_rows.is_empty() {
                        Vec::new()
                    } else {
                        let transaction_ids = transactions_rows
                            .iter()
                            .map(|transaction| transaction.id.clone())
                            .collect::<Vec<String>>();

                        transactions::table
                            .filter(transactions::id.eq_any(&transaction_ids))
                            .load::<TransactionRow>(conn)
                            .into_storage()?
                            .into_iter()
                            .map(Transaction::from)
                            .collect()
                    };

                    refresh_active_budget_projections(conn, clock.sample())?;

                    Ok((inserted_categories, inserted_transactions))
                },
            )
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection::run_migrations;
    use crate::schema::transaction_categories;
    use crate::test_utils::TempDb;
    use crate::write_actor::spawn_writer;
    use diesel::r2d2::{self, Pool};
    use diesel::sqlite::SqliteConnection;
    use uuid::Uuid;
    use zai_core::features::transaction_categories::models::NewTransactionCategory;

    fn setup_test_repo(db_path: &str) -> TransactionsRepository {
        let manager = r2d2::ConnectionManager::<SqliteConnection>::new(db_path);
        let pool = Pool::builder()
            .build(manager)
            .expect("failed to create pool");

        run_migrations(&pool).expect("failed to run migrations");

        let writer = spawn_writer(pool.clone()).expect("failed to spawn writer");
        TransactionsRepository::new(Arc::new(pool), writer)
    }

    #[tokio::test]
    async fn import_transactions_with_categories_rolls_back_when_any_transaction_is_invalid() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let category_id = Uuid::new_v4().to_string();
        let categories = vec![NewTransactionCategory {
            id: Some(category_id.clone()),
            parent_id: None,
            name: "Food".to_string(),
            description: None,
            color: None,
            role: None,
        }];

        let valid_transaction = NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some("Lunch".to_string()),
            amount: 1200,
            transaction_date: chrono::Utc::now().naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: Some(category_id),
            notes: None,
        };
        let invalid_transaction = NewTransaction {
            id: valid_transaction.id.clone(),
            description: Some("Broken".to_string()),
            amount: 800,
            transaction_date: chrono::Utc::now().naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        };

        let result = repo
            .import_transactions_with_categories(
                categories,
                vec![valid_transaction, invalid_transaction],
            )
            .await;

        assert!(result.is_err());

        let conn = &mut get_connection(&repo.pool).expect("connection");
        let persisted_categories = transaction_categories::table
            .count()
            .get_result::<i64>(conn)
            .expect("count categories");
        assert_eq!(persisted_categories, 0);
    }

    fn sample_transaction(description: &str) -> NewTransaction {
        NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some(description.to_string()),
            amount: 1000,
            transaction_date: chrono::Utc::now().naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        }
    }

    #[tokio::test]
    async fn search_query_treats_percent_as_literal() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        repo.create_transaction(sample_transaction("50% off sale"))
            .await
            .expect("create percent transaction");
        repo.create_transaction(sample_transaction("Regular lunch"))
            .await
            .expect("create plain transaction");

        let filters = TransactionSearchFilters {
            query: Some("%"),
            categories: None,
            transaction_type: None,
            start_date: None,
            end_date: None,
        };

        let result = repo
            .get_transactions(1, 10, Some(filters), None)
            .expect("search transactions");

        assert_eq!(result.data.len(), 1);
        assert_eq!(result.data[0].description.as_deref(), Some("50% off sale"));
    }

    #[derive(Debug, diesel::QueryableByName)]
    #[allow(dead_code)]
    struct ExplainQueryPlanRow {
        #[diesel(sql_type = diesel::sql_types::Integer)]
        id: i32,
        #[diesel(sql_type = diesel::sql_types::Integer)]
        parent: i32,
        #[diesel(sql_type = diesel::sql_types::Integer)]
        notused: i32,
        #[diesel(sql_type = diesel::sql_types::Text)]
        detail: String,
    }

    #[tokio::test]
    async fn active_transactions_by_date_uses_partial_index() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        repo.create_transaction(sample_transaction("Indexed lunch"))
            .await
            .expect("create transaction");

        let conn = &mut get_connection(&repo.pool).expect("connection");
        let plan = diesel::sql_query(
            "EXPLAIN QUERY PLAN \
             SELECT * FROM transactions \
             WHERE deleted_at IS NULL \
             ORDER BY transaction_date DESC, created_at ASC \
             LIMIT 10",
        )
        .load::<ExplainQueryPlanRow>(conn)
        .expect("explain query plan");

        assert!(
            plan.iter()
                .any(|row| row.detail.contains("transactions_active_date_index")),
            "expected transactions_active_date_index in query plan: {plan:?}"
        );
    }

    #[tokio::test]
    async fn search_query_treats_underscore_as_literal() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        repo.create_transaction(sample_transaction("foo_bar purchase"))
            .await
            .expect("create underscore transaction");
        repo.create_transaction(sample_transaction("foobar purchase"))
            .await
            .expect("create plain transaction");

        let filters = TransactionSearchFilters {
            query: Some("_"),
            categories: None,
            transaction_type: None,
            start_date: None,
            end_date: None,
        };

        let result = repo
            .get_transactions(1, 10, Some(filters), None)
            .expect("search transactions");

        assert_eq!(result.data.len(), 1);
        assert_eq!(
            result.data[0].description.as_deref(),
            Some("foo_bar purchase")
        );
    }
}
