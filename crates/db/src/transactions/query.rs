use diesel::expression_methods::EscapeExpressionMethods;
use diesel::prelude::*;
use zai_core::features::transactions::models::TransactionSearchFilters;
use zai_core::query::Sort;

use crate::schema::{self, transactions};

const LIKE_ESCAPE: char = '\\';

pub(crate) type TransactionBoxedQuery = diesel::helper_types::IntoBoxed<
    'static,
    diesel::helper_types::Filter<
        schema::transactions::table,
        diesel::dsl::IsNull<schema::transactions::columns::deleted_at>,
    >,
    diesel::sqlite::Sqlite,
>;

fn escape_like(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

pub(crate) fn transactions_base_query() -> TransactionBoxedQuery {
    transactions::table
        .filter(transactions::deleted_at.is_null())
        .into_boxed()
}

pub(crate) fn apply_transaction_filters(
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

pub(crate) fn apply_transaction_sort(
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

pub(crate) fn count_transactions(
    conn: &mut diesel::SqliteConnection,
    filters: Option<&TransactionSearchFilters>,
) -> diesel::QueryResult<i64> {
    apply_transaction_filters(transactions_base_query(), filters)
        .count()
        .get_result(conn)
}
