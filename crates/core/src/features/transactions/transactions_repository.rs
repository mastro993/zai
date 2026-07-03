use crate::database::pagination::{Paginate, PaginatedData};
use crate::database::sorting::Sort;
use crate::database::{WriteHandle, get_connection};
use crate::errors::{Error, Result};
use crate::features::transactions::transactions_models::{
    NewTransaction, Transaction, TransactionRow, TransactionSearchFilters, TransactionUpdate,
};
use crate::features::transactions::transactions_traits::TransactionsRepositoryTrait;
use crate::schema::transactions;
use async_trait::async_trait;
use chrono::Local;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use uuid::Uuid;

pub struct TransactionsRepository {
    pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
    writer: WriteHandle,
}

impl TransactionsRepository {
    pub fn new(
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
                query = query.filter(
                    transactions::description
                        .like(query_filter)
                        .or(transactions::notes.like(query_filter)),
                );
            }
            if let Some(ref categories_filter) = filters.categories {
                query =
                    query.filter(transactions::transaction_category_id.eq_any(categories_filter));
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
            .load_and_count_pages::<TransactionRow>(conn)?;

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
            .map_err(|e| Error::NotFound(e.to_string()))?;

        Ok(result.into())
    }

    async fn create_transaction(&self, new_transaction: NewTransaction) -> Result<Transaction> {
        new_transaction.validate()?;

        let new_transaction = new_transaction.clone();
        let new_id = Uuid::new_v4().to_string();

        self.writer
            .exec(move |conn: &mut SqliteConnection| -> Result<Transaction> {
                let mut transaction: TransactionRow = new_transaction.into();
                transaction.id = new_id.clone();

                diesel::insert_into(transactions::table)
                    .values(&transaction)
                    .execute(conn)?;

                let inserted = transactions::table
                    .filter(transactions::id.eq(&new_id))
                    .first::<TransactionRow>(conn)?;

                Ok(inserted.into())
            })
            .await
    }

    async fn update_transaction(
        &self,
        updated_transaction: TransactionUpdate,
    ) -> Result<Transaction> {
        updated_transaction.validate()?;

        self.writer
            .exec(move |conn: &mut SqliteConnection| -> Result<Transaction> {
                let mut transaction: TransactionRow = updated_transaction.into();

                let existing = transactions::table
                    .find(&transaction.id)
                    .first::<TransactionRow>(conn)
                    .map_err(|e| Error::NotFound(e.to_string()))?;

                transaction.created_at = existing.created_at;
                transaction.updated_at = chrono::Utc::now().naive_utc();

                diesel::update(transactions::table.find(&transaction.id))
                    .set(&transaction)
                    .execute(conn)?;

                Ok(transaction.into())
            })
            .await
    }

    async fn delete_transaction(&self, id: &str) -> Result<Transaction> {
        let transaction_id = id.to_owned();

        self.writer
            .exec(move |conn: &mut SqliteConnection| -> Result<Transaction> {
                let now = Local::now().naive_utc();

                diesel::update(transactions::table.find(&transaction_id))
                    .set(transactions::deleted_at.eq(now))
                    .execute(conn)?;

                let deleted = transactions::table
                    .find(&transaction_id)
                    .filter(transactions::deleted_at.is_not_null())
                    .first::<TransactionRow>(conn)?;

                Ok(deleted.into())
            })
            .await
    }

    async fn delete_transactions(&self, ids: Vec<&str>) -> Result<Vec<Transaction>> {
        let owned_ids = ids.iter().map(|&s| s.to_string()).collect::<Vec<String>>();

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> Result<Vec<Transaction>> {
                    let now = Local::now().naive_utc();

                    diesel::update(transactions::table.filter(transactions::id.eq_any(&owned_ids)))
                        .set(transactions::deleted_at.eq(now))
                        .execute(conn)?;

                    let deleted = transactions::table
                        .filter(transactions::id.eq_any(&owned_ids))
                        .filter(transactions::deleted_at.is_not_null())
                        .load::<TransactionRow>(conn)?;

                    let deleted_transactions: Vec<Transaction> =
                        deleted.into_iter().map(Transaction::from).collect();
                    Ok(deleted_transactions)
                },
            )
            .await
    }

    async fn import_transactions(
        &self,
        new_transactions: Vec<NewTransaction>,
    ) -> Result<Vec<Transaction>> {
        let valid_transactions = new_transactions
            .iter()
            .filter(|c| c.validate().is_ok())
            .cloned()
            .collect::<Vec<_>>();

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> Result<Vec<Transaction>> {
                    let transactions_rows: Vec<TransactionRow> = valid_transactions
                        .iter()
                        .map(|c| c.clone().into())
                        .collect();

                    diesel::insert_into(transactions::table)
                        .values(&transactions_rows)
                        .execute(conn)?;

                    let ids = transactions_rows
                        .iter()
                        .map(|c| c.id.clone())
                        .collect::<Vec<String>>();

                    let inserted = transactions::table
                        .filter(transactions::id.eq_any(&ids))
                        .load::<TransactionRow>(conn)?;

                    Ok(inserted.into_iter().map(Transaction::from).collect())
                },
            )
            .await
    }
}
