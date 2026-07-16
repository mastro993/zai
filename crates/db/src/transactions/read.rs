use std::sync::Arc;

use diesel::prelude::*;
use zai_core::Result;
use zai_core::features::transactions::models::{
    DuplicateKeyCandidate, Transaction, TransactionSearchFilters,
};
use zai_core::query::{PaginatedData, Sort};

use super::bulk_ops;
use super::models::TransactionRow;
use super::query::{
    apply_transaction_filters, apply_transaction_sort, count_transactions, transactions_base_query,
};
use super::repository::TransactionsRepository;
use crate::blocking::run_blocking;
use crate::connection::get_connection;
use crate::errors::IntoCore;
use crate::pagination::{Paginate, total_pages};
use crate::schema::transactions;

pub(super) async fn get_transactions(
    repository: &TransactionsRepository,
    page: i64,
    per_page: i64,
    filters: Option<TransactionSearchFilters<'_>>,
    sort: Option<Sort>,
) -> Result<PaginatedData<Transaction>> {
    let pool = Arc::clone(&repository.pool);
    let owned_query = filters.as_ref().and_then(|f| f.query.map(str::to_owned));
    let owned_categories = filters
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

pub(super) async fn get_transaction(
    repository: &TransactionsRepository,
    id: &str,
) -> Result<Transaction> {
    let pool = Arc::clone(&repository.pool);
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

pub(super) async fn get_filtered_transaction_ids(
    repository: &TransactionsRepository,
    filters: Option<TransactionSearchFilters<'_>>,
    sort: Option<Sort>,
) -> Result<Vec<String>> {
    let pool = Arc::clone(&repository.pool);
    let owned_query = filters.as_ref().and_then(|f| f.query.map(str::to_owned));
    let owned_categories = filters
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

pub(super) async fn export_transactions_csv(
    repository: &TransactionsRepository,
    filters: Option<TransactionSearchFilters<'_>>,
    transaction_ids: Option<Vec<String>>,
) -> Result<String> {
    let pool = Arc::clone(&repository.pool);
    let owned_query = filters.as_ref().and_then(|f| f.query.map(str::to_owned));
    let owned_categories = filters
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

pub(super) async fn find_existing_duplicate_keys(
    repository: &TransactionsRepository,
    candidates: Vec<DuplicateKeyCandidate>,
) -> Result<Vec<String>> {
    let pool = Arc::clone(&repository.pool);
    run_blocking(move || {
        let conn = &mut get_connection(&pool)?;
        bulk_ops::find_existing_duplicate_keys(conn, &candidates)
    })
    .await
}
