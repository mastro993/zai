use std::collections::{HashMap, HashSet};

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::transactions::dedup::duplicate_key;
use zai_core::features::transactions::export_csv::{
    CsvCategoryColumns, CsvTransactionRow, format_transactions_csv,
};
use zai_core::features::transactions::models::{DuplicateKeyCandidate, TransactionSearchFilters};
use zai_core::query::Sort;

use crate::errors::{IntoCore, IntoStorage};
use crate::schema::{transaction_categories, transactions};
use crate::transaction_categories::models::TransactionCategoryRow;

use super::import_dedup;
use super::models::TransactionRow;
use super::query::{apply_transaction_filters, apply_transaction_sort, transactions_base_query};

pub(crate) fn get_filtered_transaction_ids(
    conn: &mut SqliteConnection,
    filters: Option<&TransactionSearchFilters>,
    sort: Option<&Sort>,
) -> Result<Vec<String>> {
    let query = apply_transaction_sort(
        apply_transaction_filters(transactions_base_query(), filters),
        sort,
    );

    query
        .select(transactions::id)
        .load::<String>(conn)
        .into_core()
}

pub(crate) fn export_transactions_csv(
    conn: &mut SqliteConnection,
    filters: Option<&TransactionSearchFilters>,
    transaction_ids: Option<&[String]>,
) -> Result<String> {
    let mut query = transactions_base_query();

    if let Some(ids) = transaction_ids {
        if ids.is_empty() {
            return Ok(format_transactions_csv(&[]));
        }
        let owned_ids = ids.to_vec();
        query = query.filter(transactions::id.eq_any(owned_ids));
    } else {
        query = apply_transaction_filters(query, filters);
    }

    let query = apply_transaction_sort(query, None);
    let rows = query
        .select(transactions::all_columns)
        .load::<TransactionRow>(conn)
        .into_core()?;

    let category_lookup = load_category_lookup(conn, &rows)?;
    let csv_rows = rows
        .iter()
        .map(|row| to_csv_row(row, &category_lookup))
        .collect::<Vec<_>>();

    Ok(format_transactions_csv(&csv_rows))
}

pub(crate) fn find_existing_duplicate_keys(
    conn: &mut SqliteConnection,
    candidates: &[DuplicateKeyCandidate],
) -> Result<Vec<String>> {
    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    let dates = candidates
        .iter()
        .map(|candidate| candidate.transaction_date)
        .collect::<Vec<_>>();
    let (range_start, range_end_exclusive) =
        import_dedup::half_open_date_range_from_dates(&dates).expect("non-empty candidates");

    let existing_rows = transactions::table
        .filter(transactions::deleted_at.is_null())
        .filter(transactions::transaction_date.ge(range_start))
        .filter(transactions::transaction_date.lt(range_end_exclusive))
        .load::<TransactionRow>(conn)
        .into_storage()?;

    let existing_keys = existing_rows
        .iter()
        .map(|transaction| {
            duplicate_key(
                transaction.transaction_date,
                transaction.amount,
                transaction.description.as_deref(),
            )
        })
        .collect::<HashSet<String>>();

    Ok(candidates
        .iter()
        .filter_map(|candidate| {
            let key = duplicate_key(
                candidate.transaction_date,
                candidate.amount,
                candidate.description.as_deref(),
            );
            existing_keys.contains(&key).then_some(key)
        })
        .collect())
}

fn load_category_lookup(
    conn: &mut SqliteConnection,
    rows: &[TransactionRow],
) -> Result<HashMap<String, TransactionCategoryRow>> {
    let category_ids = rows
        .iter()
        .filter_map(|row| row.transaction_category_id.as_deref())
        .map(str::to_string)
        .collect::<HashSet<_>>();

    if category_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let mut categories = transaction_categories::table
        .filter(transaction_categories::deleted_at.is_null())
        .filter(transaction_categories::id.eq_any(&category_ids))
        .load::<TransactionCategoryRow>(conn)
        .into_storage()?;

    let parent_ids = categories
        .iter()
        .filter_map(|category| category.parent_id.as_deref())
        .filter(|parent_id| !category_ids.contains(*parent_id))
        .map(str::to_string)
        .collect::<Vec<_>>();

    if !parent_ids.is_empty() {
        let parents = transaction_categories::table
            .filter(transaction_categories::deleted_at.is_null())
            .filter(transaction_categories::id.eq_any(&parent_ids))
            .load::<TransactionCategoryRow>(conn)
            .into_storage()?;
        categories.extend(parents);
    }

    Ok(categories
        .into_iter()
        .map(|category| (category.id.clone(), category))
        .collect())
}

fn category_columns(
    category_id: Option<&str>,
    categories_by_id: &HashMap<String, TransactionCategoryRow>,
) -> CsvCategoryColumns {
    let Some(category_id) = category_id else {
        return CsvCategoryColumns {
            parent_category: String::new(),
            category: String::new(),
        };
    };

    let Some(category) = categories_by_id.get(category_id) else {
        return CsvCategoryColumns {
            parent_category: String::new(),
            category: String::new(),
        };
    };

    if let Some(parent_id) = category.parent_id.as_deref() {
        let parent_name = categories_by_id
            .get(parent_id)
            .map(|parent| parent.name.as_str())
            .unwrap_or_default()
            .to_string();

        return CsvCategoryColumns {
            parent_category: parent_name,
            category: category.name.clone(),
        };
    }

    CsvCategoryColumns {
        parent_category: String::new(),
        category: category.name.clone(),
    }
}

fn to_csv_row<'a>(
    row: &'a TransactionRow,
    categories_by_id: &HashMap<String, TransactionCategoryRow>,
) -> CsvTransactionRow<'a> {
    CsvTransactionRow {
        transaction_date: row.transaction_date,
        amount: row.amount,
        transaction_type: row.transaction_type.as_str(),
        description: row.description.as_deref(),
        notes: row.notes.as_deref(),
        category: category_columns(row.transaction_category_id.as_deref(), categories_by_id),
    }
}
