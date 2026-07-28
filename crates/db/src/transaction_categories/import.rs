use std::collections::{HashMap, HashSet};

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::features::transaction_categories::models::{
    CategoryRole, NewTransactionCategory, TransactionCategory,
};
use zai_core::{Error, Result};

use super::models::TransactionCategoryRow;
use super::read::category_from_row;
use super::repository::TransactionCategoriesRepository;
use super::validation::{ResolvedParent, apply_resolved_parent, map_category_unique_violation};
use crate::errors::{IntoStorage, Result as StorageResult, StorageError};
use crate::schema::transaction_categories;

const SQLITE_LEGACY_BIND_LIMIT: usize = 999;
const IMPORT_INSERT_BIND_COLUMNS: usize = 6;
const IMPORT_INSERT_CHUNK_SIZE: usize = SQLITE_LEGACY_BIND_LIMIT / IMPORT_INSERT_BIND_COLUMNS;
const DUPLICATE_NAME_MESSAGE: &str = "A category with this name already exists at the same level";
const CATEGORY_DEPTH_MESSAGE: &str =
    "Cannot create categories deeper than 2 levels. The parent category must be a root category.";

struct CategoryMetadata {
    parent_id: Option<String>,
    role: String,
}

#[derive(Insertable)]
#[diesel(table_name = transaction_categories)]
#[diesel(treat_none_as_default_value = false)]
struct ImportCategoryInsert<'a> {
    id: &'a str,
    parent_id: Option<&'a str>,
    name: &'a str,
    description: Option<&'a str>,
    color: Option<&'a str>,
    role: &'a str,
}

impl<'a> From<&'a TransactionCategoryRow> for ImportCategoryInsert<'a> {
    fn from(row: &'a TransactionCategoryRow) -> Self {
        Self {
            id: &row.id,
            parent_id: row.parent_id.as_deref(),
            name: &row.name,
            description: row.description.as_deref(),
            color: row.color.as_deref(),
            role: &row.role,
        }
    }
}

struct ImportValidationState {
    categories_by_id: HashMap<String, CategoryMetadata>,
    sibling_names: HashSet<(Option<String>, String)>,
}

impl ImportValidationState {
    fn load(conn: &mut SqliteConnection) -> StorageResult<Self> {
        let categories = transaction_categories::table
            .filter(transaction_categories::deleted_at.is_null())
            .select((
                transaction_categories::id,
                transaction_categories::parent_id,
                transaction_categories::name,
                transaction_categories::role,
            ))
            .load::<(String, Option<String>, String, String)>(conn)
            .into_storage()?;
        let mut categories_by_id = HashMap::with_capacity(categories.len());
        let mut sibling_names = HashSet::with_capacity(categories.len());

        for (id, parent_id, name, role) in categories {
            sibling_names.insert((parent_id.clone(), normalize_name(&name)));
            categories_by_id.insert(id, CategoryMetadata { parent_id, role });
        }

        Ok(Self {
            categories_by_id,
            sibling_names,
        })
    }

    fn prepare_row(
        &mut self,
        mut row: TransactionCategoryRow,
    ) -> StorageResult<TransactionCategoryRow> {
        let resolved_parent = self.resolve_parent(row.parent_id.as_deref())?;
        let sibling_parent_id = resolved_parent.as_ref().map(|parent| parent.id.clone());
        let sibling_key = (sibling_parent_id, normalize_name(&row.name));

        if !self.sibling_names.insert(sibling_key) {
            return Err(category_conflict());
        }

        apply_resolved_parent(&mut row, resolved_parent);
        if self.categories_by_id.contains_key(&row.id) {
            return Err(category_conflict());
        }

        self.categories_by_id.insert(
            row.id.clone(),
            CategoryMetadata {
                parent_id: row.parent_id.clone(),
                role: row.role.clone(),
            },
        );
        Ok(row)
    }

    fn resolve_parent(&self, parent_id: Option<&str>) -> StorageResult<Option<ResolvedParent>> {
        let Some(parent_id) = parent_id.filter(|id| !id.trim().is_empty()) else {
            return Ok(None);
        };
        let parent = self
            .categories_by_id
            .get(parent_id)
            .ok_or(StorageError::QueryFailed(diesel::result::Error::NotFound))?;

        if parent.parent_id.is_some() {
            return Err(StorageError::CoreError(Error::Conflict(
                CATEGORY_DEPTH_MESSAGE.to_string(),
            )));
        }

        let role = parent.role.parse::<CategoryRole>().map_err(|_| {
            StorageError::CoreError(Error::Repository("Invalid category role".to_string()))
        })?;
        Ok(Some(ResolvedParent {
            id: parent_id.to_string(),
            role,
        }))
    }
}

fn normalize_name(name: &str) -> String {
    name.trim().to_lowercase()
}

fn category_conflict() -> StorageError {
    StorageError::CoreError(Error::Conflict(DUPLICATE_NAME_MESSAGE.to_string()))
}

pub(crate) fn insert_import_categories(
    conn: &mut SqliteConnection,
    new_categories: Vec<NewTransactionCategory>,
) -> StorageResult<Vec<TransactionCategoryRow>> {
    if new_categories.is_empty() {
        return Ok(Vec::new());
    }

    let (roots, children): (Vec<_>, Vec<_>) = new_categories.into_iter().partition(|category| {
        category
            .parent_id
            .as_deref()
            .is_none_or(|parent_id| parent_id.trim().is_empty())
    });
    let mut state = ImportValidationState::load(conn)?;
    let mut rows = Vec::with_capacity(roots.len() + children.len());

    for category in roots.into_iter().chain(children) {
        rows.push(state.prepare_row(category.into())?);
    }

    for chunk in rows.chunks(IMPORT_INSERT_CHUNK_SIZE) {
        let insertable = chunk
            .iter()
            .map(ImportCategoryInsert::from)
            .collect::<Vec<_>>();
        diesel::insert_into(transaction_categories::table)
            .values(&insertable)
            .execute(conn)
            .into_storage()
            .map_err(map_category_unique_violation)?;
    }

    Ok(rows)
}

pub(super) async fn import_categories(
    repository: &TransactionCategoriesRepository,
    new_categories: Vec<NewTransactionCategory>,
) -> Result<Vec<TransactionCategory>> {
    if new_categories.is_empty() {
        return Ok(Vec::new());
    }

    repository
        .writer
        .exec(
            move |conn: &mut SqliteConnection| -> crate::errors::Result<Vec<TransactionCategory>> {
                let categories = insert_import_categories(conn, new_categories)?;

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
