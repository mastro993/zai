use super::models::TransactionRow;
use crate::connection::{DbPool, get_connection};
use crate::errors::{IntoCore, IntoStorage};
use crate::pagination::Paginate;
use crate::schema::{transaction_categories, transactions};
use crate::transaction_categories::models::TransactionCategoryRow;
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use chrono::Local;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::transaction_categories::models::{
    NewTransactionCategory, TransactionCategory,
};
use zai_core::features::transactions::models::{
    NewTransaction, Transaction, TransactionSearchFilters, TransactionUpdate,
};
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;
use zai_core::query::{PaginatedData, Sort};

pub struct TransactionsRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
}

impl TransactionsRepository {
    pub(crate) fn new(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
    ) -> Self {
        Self { pool, writer }
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

        let mut query = transactions::table
            .filter(transactions::deleted_at.is_null())
            .into_boxed();

        if let Some(ref filters) = filters {
            if let Some(ref query_filter) = filters.query {
                let query_pattern = format!("%{}%", query_filter);
                let notes_query_pattern = query_pattern.clone();
                query = query.filter(
                    transactions::description
                        .like(query_pattern)
                        .or(transactions::notes.like(notes_query_pattern)),
                );
            }
            if let Some(ref categories_filter) = filters.categories {
                if categories_filter.is_empty() {
                    query = query.filter(transactions::transaction_category_id.is_null());
                } else {
                    query = query
                        .filter(transactions::transaction_category_id.eq_any(categories_filter));
                }
            }
            if let Some(ref type_filter) = filters.transaction_type {
                query = query.filter(transactions::transaction_type.eq(type_filter));
            }
            if let Some(ref start_date_filter) = filters.start_date {
                query = query.filter(transactions::transaction_date.ge(start_date_filter));
            }
            if let Some(ref end_date_filter) = filters.end_date {
                query = query.filter(transactions::transaction_date.le(end_date_filter));
            }
        }

        if let Some(ref sort) = sort {
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
                } // Default order
            }
        } else {
            query = query.order((
                transactions::transaction_date.desc(),
                transactions::created_at.asc(),
            )); // Default order
        }

        let (page_rows, total_pages) = query
            .select(transactions::all_columns)
            .paginate(page)
            .per_page(per_page)
            .load_and_count_pages::<TransactionRow>(conn)
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

                    Ok(inserted.into())
                },
            )
            .await
    }

    async fn update_transaction(
        &self,
        updated_transaction: TransactionUpdate,
    ) -> Result<Transaction> {
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

                    Ok(transaction.into())
                },
            )
            .await
    }

    async fn delete_transaction(&self, id: &str) -> Result<Transaction> {
        let transaction_id = id.to_owned();

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

                    Ok(deleted.into())
                },
            )
            .await
    }

    async fn delete_transactions(&self, ids: Vec<&str>) -> Result<Vec<Transaction>> {
        let owned_ids = ids.iter().map(|&s| s.to_string()).collect::<Vec<String>>();

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
                            .map(TransactionCategory::from)
                            .collect()
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
}
