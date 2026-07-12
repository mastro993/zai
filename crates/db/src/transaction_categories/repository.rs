use super::models::TransactionCategoryRow;
use crate::budgets::projection::refresh_active_budget_projections;
use crate::connection::{DbPool, get_connection};
use crate::errors::{IntoCore, IntoStorage, StorageError};
use crate::schema::{transaction_categories, transactions};
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use chrono::Local;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::transaction_categories::models::{
    CategoryChildrenDeleteStrategy, NewTransactionCategory, TransactionCategory,
    TransactionCategoryUpdate,
};
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;

fn category_from_row(row: TransactionCategoryRow) -> crate::errors::Result<TransactionCategory> {
    row.try_into().map_err(StorageError::CoreError)
}

fn category_from_rows(
    row: TransactionCategoryRow,
    parent_row: Option<TransactionCategoryRow>,
) -> crate::errors::Result<TransactionCategory> {
    let mut category = category_from_row(row)?;
    if let Some(parent_row) = parent_row {
        let parent = category_from_row(parent_row)?;
        category.role = parent.role;
        category.parent = Some(Box::new(parent));
    }
    Ok(category)
}

pub struct TransactionCategoriesRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
    clock: Arc<dyn CalendarClock>,
}

impl TransactionCategoriesRepository {
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
impl TransactionCategoriesRepositoryTrait for TransactionCategoriesRepository {
    fn get_categories(&self, parent_id: Option<&str>) -> Result<Vec<TransactionCategory>> {
        let conn = &mut get_connection(&self.pool)?;

        let parent_categories = diesel::alias!(transaction_categories as parent_categories);
        let mut query = transaction_categories::table
            .left_join(
                parent_categories.on(
                    // Compare the child's parent_id with the aliased parent's id.
                    // We use .nullable() to match the types, as parent_id is nullable.
                    transaction_categories::parent_id.eq(parent_categories
                        .field(transaction_categories::id)
                        .nullable()),
                ),
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
    }

    fn get_category(&self, id: &str) -> Result<TransactionCategory> {
        let conn = &mut get_connection(&self.pool)?;

        let parent_categories = diesel::alias!(transaction_categories as parent_categories);

        let (category_row, parent_row) = transaction_categories::table
            .left_join(
                parent_categories.on(
                    // Compare the child's parent_id with the aliased parent's id.
                    // We use .nullable() to match the types, as parent_id is nullable.
                    transaction_categories::parent_id.eq(parent_categories
                        .field(transaction_categories::id)
                        .nullable()),
                ),
            )
            .filter(transaction_categories::id.eq(id))
            .filter(transaction_categories::deleted_at.is_null())
            .first::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
            .into_core()?;

        category_from_rows(category_row, parent_row).map_err(StorageError::into)
    }

    fn category_has_children(&self, id: &str) -> Result<bool> {
        let conn = &mut get_connection(&self.pool)?;

        let child_count = transaction_categories::table
            .filter(transaction_categories::parent_id.eq(id))
            .filter(transaction_categories::deleted_at.is_null())
            .count()
            .get_result::<i64>(conn)
            .into_core()?;

        Ok(child_count > 0)
    }

    fn sibling_name_exists(
        &self,
        parent_id: Option<&str>,
        name: &str,
        excluded_id: Option<&str>,
    ) -> Result<bool> {
        let conn = &mut get_connection(&self.pool)?;
        let normalized_name = name.trim().to_lowercase();

        let mut query = transaction_categories::table
            .filter(transaction_categories::deleted_at.is_null())
            .into_boxed();

        query = match parent_id {
            Some(parent_id) => query.filter(transaction_categories::parent_id.eq(parent_id)),
            None => query.filter(transaction_categories::parent_id.is_null()),
        };

        if let Some(excluded_id) = excluded_id {
            query = query.filter(transaction_categories::id.ne(excluded_id));
        }

        let sibling_names = query
            .select(transaction_categories::name)
            .load::<String>(conn)
            .into_core()?;

        Ok(sibling_names
            .iter()
            .any(|sibling_name| sibling_name.trim().to_lowercase() == normalized_name))
    }

    async fn create_category(
        &self,
        new_category: NewTransactionCategory,
    ) -> Result<TransactionCategory> {
        let clock = Arc::clone(&self.clock);
        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<TransactionCategory> {
                    let category: TransactionCategoryRow = new_category.into();
                    let category_id = category.id.clone();

                    diesel::insert_into(transaction_categories::table)
                        .values(&category)
                        .execute(conn)
                        .into_storage()?;

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
                        .filter(transaction_categories::id.eq(&category_id))
                        .first::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
                        .into_storage()?;

                    let category = category_from_rows(category_row, parent_row)?;
                    refresh_active_budget_projections(conn, clock.sample())?;
                    Ok(category)
                },
            )
            .await
    }

    async fn update_category(
        &self,
        updated_category: TransactionCategoryUpdate,
    ) -> Result<TransactionCategory> {
        let clock = Arc::clone(&self.clock);
        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<TransactionCategory> {
                    let mut category: TransactionCategoryRow = updated_category.into();

                    let existing = transaction_categories::table
                        .find(&category.id)
                        .first::<TransactionCategoryRow>(conn)
                        .into_storage()?;

                    category.created_at = existing.created_at;
                    category.updated_at = chrono::Utc::now().naive_utc();

                    diesel::update(transaction_categories::table.find(&category.id))
                        .set(&category)
                        .execute(conn)
                        .into_storage()?;

                    if category.parent_id.is_none() {
                        diesel::update(
                            transaction_categories::table
                                .filter(transaction_categories::parent_id.eq(&category.id))
                                .filter(transaction_categories::deleted_at.is_null()),
                        )
                        .set((
                            transaction_categories::role.eq(&category.role),
                            transaction_categories::updated_at.eq(category.updated_at),
                        ))
                        .execute(conn)
                        .into_storage()?;
                    }

                    let parent_categories =
                        diesel::alias!(transaction_categories as parent_categories);

                    let (category_row, parent_row) = transaction_categories::table
                        .left_join(
                            parent_categories.on(
                                // Compare the child's parent_id with the aliased parent's id.
                                // We use .nullable() to match the types, as parent_id is nullable.
                                transaction_categories::parent_id.eq(parent_categories
                                    .field(transaction_categories::id)
                                    .nullable()),
                            ),
                        )
                        .filter(transaction_categories::id.eq(&category.id))
                        .first::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
                        .into_storage()?;

                    let category = category_from_rows(category_row, parent_row)?;
                    refresh_active_budget_projections(conn, clock.sample())?;
                    Ok(category)
                },
            )
            .await
    }

    async fn delete_categories(
        &self,
        ids: Vec<&str>,
        children_strategy: CategoryChildrenDeleteStrategy,
    ) -> Result<Vec<TransactionCategory>> {
        let owned_ids = ids.iter().map(|&s| s.to_string()).collect::<Vec<String>>();
        let clock = Arc::clone(&self.clock);
        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<Vec<TransactionCategory>> {
                    let now = Local::now().naive_utc();
                    let mut ids_to_delete = owned_ids.clone();

                    if children_strategy == CategoryChildrenDeleteStrategy::Delete {
                        let child_ids = transaction_categories::table
                            .filter(transaction_categories::parent_id.eq_any(&owned_ids))
                            .filter(transaction_categories::deleted_at.is_null())
                            .select(transaction_categories::id)
                            .load::<String>(conn)
                            .into_storage()?;

                        ids_to_delete.extend(child_ids);
                        ids_to_delete.sort();
                        ids_to_delete.dedup();
                    }

                    if children_strategy == CategoryChildrenDeleteStrategy::Promote {
                        diesel::update(
                            transaction_categories::table
                                .filter(transaction_categories::parent_id.eq_any(&owned_ids))
                                .filter(transaction_categories::deleted_at.is_null()),
                        )
                        .set((
                            transaction_categories::parent_id.eq(None::<String>),
                            transaction_categories::updated_at.eq(now),
                        ))
                        .execute(conn)
                        .into_storage()?;
                    }

                    diesel::update(
                        transaction_categories::table
                            .filter(transaction_categories::id.eq_any(&ids_to_delete)),
                    )
                    .set(transaction_categories::deleted_at.eq(now))
                    .execute(conn)
                    .into_storage()?;

                    diesel::update(
                        transactions::table.filter(
                            transactions::transaction_category_id.eq_any(&ids_to_delete),
                        ),
                    )
                    .set((
                        transactions::transaction_category_id.eq(None::<String>),
                        transactions::updated_at.eq(now),
                    ))
                    .execute(conn)
                    .into_storage()?;

                    let deleted = transaction_categories::table
                        .filter(transaction_categories::id.eq_any(&ids_to_delete))
                        .filter(transaction_categories::deleted_at.is_not_null())
                        .load::<TransactionCategoryRow>(conn)
                        .into_storage()?;

                    let categories = deleted
                        .into_iter()
                        .map(category_from_row)
                        .collect::<crate::errors::Result<Vec<_>>>()?;
                    refresh_active_budget_projections(conn, clock.sample())?;
                    Ok(categories)
                },
            )
            .await
    }

    async fn import_categories(
        &self,
        new_categories: Vec<NewTransactionCategory>,
    ) -> Result<Vec<TransactionCategory>> {
        if new_categories.is_empty() {
            return Ok(Vec::new());
        }

        let clock = Arc::clone(&self.clock);
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
                    refresh_active_budget_projections(conn, clock.sample())?;
                    Ok(inserted)
                },
            )
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection::run_migrations;
    use crate::test_utils::TempDb;
    use crate::write_actor::spawn_writer;
    use uuid::Uuid;
    use zai_core::features::transaction_categories::models::{
        CategoryRole, NewTransactionCategory, TransactionCategory,
    };
    use zai_core::features::transactions::models::NewTransaction;

    fn setup_test_repo(db_path: &str) -> TransactionCategoriesRepository {
        let manager = r2d2::ConnectionManager::<SqliteConnection>::new(db_path);
        let pool = Pool::builder()
            .build(manager)
            .expect("Failed to create pool");

        run_migrations(&pool.clone()).unwrap();

        let writer = spawn_writer(pool.clone()).unwrap();

        TransactionCategoriesRepository::new(Arc::new(pool), writer)
    }

    fn insert_transaction_with_category(repo: &TransactionCategoriesRepository, category_id: &str) {
        let conn = &mut get_connection(&repo.pool).unwrap();
        let transaction = NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some("Lunch".to_string()),
            amount: 1200,
            transaction_date: chrono::Utc::now().naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: Some(category_id.to_string()),
            notes: None,
        };

        diesel::insert_into(transactions::table)
            .values((
                transactions::id.eq(transaction.id.unwrap()),
                transactions::description.eq(transaction.description),
                transactions::amount.eq(transaction.amount),
                transactions::transaction_date.eq(transaction.transaction_date),
                transactions::transaction_type.eq(transaction.transaction_type),
                transactions::transaction_category_id.eq(transaction.transaction_category_id),
                transactions::notes.eq(transaction.notes),
            ))
            .execute(conn)
            .unwrap();
    }

    #[tokio::test]
    async fn test_get_categories() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let cat1 = NewTransactionCategory {
            name: "Cat 1".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let cat2 = NewTransactionCategory {
            name: "Cat 2".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let cat3 = NewTransactionCategory {
            name: "Cat 3".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };

        repo.create_category(cat1).await.unwrap();
        repo.create_category(cat2).await.unwrap();
        let created = repo.create_category(cat3).await.unwrap();
        repo.delete_categories(vec![&created.id], CategoryChildrenDeleteStrategy::Block)
            .await
            .unwrap();

        let all = repo.get_categories(None).unwrap();
        assert!(all.len() == 2);
    }

    #[tokio::test]
    async fn test_get_category() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let parent = repo.create_category(parent).await.unwrap();

        let child = NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let child = repo.create_category(child).await.unwrap();

        let category = repo.get_category(&child.id).unwrap();
        assert_eq!(category.id, child.id);
        assert_eq!(category.parent.unwrap().id, parent.id);
    }

    #[tokio::test]
    async fn test_get_categories_by_parent_id() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        // Create a parent first
        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let parent = repo.create_category(parent).await.unwrap();

        let cat1 = NewTransactionCategory {
            name: "Cat 1".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let cat2 = NewTransactionCategory {
            name: "Cat 2".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let cat3 = NewTransactionCategory {
            name: "Cat 3".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };

        repo.create_category(cat1).await.unwrap();
        repo.create_category(cat2).await.unwrap();
        let created = repo.create_category(cat3).await.unwrap();
        repo.delete_categories(vec![&created.id], CategoryChildrenDeleteStrategy::Block)
            .await
            .unwrap();

        let all = repo.get_categories(Some(&parent.id)).unwrap();
        assert!(all.len() == 1);
        assert!(all[0].name == "Cat 1");
    }

    #[tokio::test]
    async fn test_create_category() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category = NewTransactionCategory {
            name: "Test Category".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };

        let created: TransactionCategory = repo.create_category(new_category).await.unwrap();

        assert!(!created.id.is_empty());
        assert_eq!(created.name, "Test Category");
        assert_eq!(created.description.as_deref(), Some("Descrizione test"));
        assert_eq!(created.color.as_deref(), Some("#FF0000"));
    }

    #[tokio::test]
    async fn test_update_category() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category = NewTransactionCategory {
            name: "Original".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created = repo.create_category(new_category).await.unwrap();

        let updated = TransactionCategoryUpdate {
            id: created.id,
            name: "Updated".to_string(),
            parent_id: None,
            description: Some("Updated description".to_string()),
            color: Some("#3C99F6".to_string()),
            role: None,
        };

        let updated_category = repo.update_category(updated).await.unwrap();

        assert_eq!(updated_category.name, "Updated");
        assert_eq!(
            updated_category.description.as_deref(),
            Some("Updated description")
        );
        assert_eq!(updated_category.color.as_deref(), Some("#3C99F6"));
    }

    #[tokio::test]
    async fn updating_a_root_role_updates_child_effective_roles() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = repo
            .create_category(NewTransactionCategory {
                name: "Salary".to_string(),
                parent_id: None,
                description: None,
                color: None,
                role: Some(CategoryRole::Income),
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();
        let child = repo
            .create_category(NewTransactionCategory {
                name: "Bonus".to_string(),
                parent_id: Some(parent.id.clone()),
                description: None,
                color: None,
                role: Some(CategoryRole::Income),
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();

        repo.update_category(TransactionCategoryUpdate {
            id: parent.id,
            name: "Salary".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
        })
        .await
        .unwrap();

        assert_eq!(
            repo.get_category(&child.id).unwrap().role,
            CategoryRole::Spending
        );
    }

    #[tokio::test]
    async fn test_update_category_clears_description() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let created = repo
            .create_category(NewTransactionCategory {
                name: "Original".to_string(),
                parent_id: None,
                description: Some("Original description".to_string()),
                color: Some("#D31212".to_string()),
                role: None,
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();

        let updated_category = repo
            .update_category(TransactionCategoryUpdate {
                id: created.id,
                name: "Original".to_string(),
                parent_id: None,
                description: None,
                color: Some("#D31212".to_string()),
                role: None,
            })
            .await
            .unwrap();

        assert_eq!(updated_category.description, None);
    }

    #[tokio::test]
    async fn test_delete_categories() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category_1 = NewTransactionCategory {
            name: "To Delete".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_1 = repo.create_category(new_category_1).await.unwrap();

        let new_category_2 = NewTransactionCategory {
            name: "To Delete Too".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_2 = repo.create_category(new_category_2).await.unwrap();

        let deleted = repo
            .delete_categories(
                vec![&created_1.id, &created_2.id],
                CategoryChildrenDeleteStrategy::Block,
            )
            .await
            .unwrap();

        assert_eq!(deleted.len(), 2);
    }

    #[tokio::test]
    async fn test_import_categories() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category_1 = NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            name: "Test Category 1".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            role: None,
        };

        let new_category_2 = NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            name: "Test Category 2".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            role: None,
        };

        let new_category_3 = NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            name: "Test Category 3".to_string(),
            parent_id: Some(new_category_1.id.as_deref().unwrap().to_string()),
            description: Some("Descrizione test".to_string()),
            color: Some("#DB1313".to_string()),
            role: None,
        };

        let created: Vec<TransactionCategory> = repo
            .import_categories(vec![new_category_1, new_category_2, new_category_3])
            .await
            .unwrap();

        assert_eq!(created.len(), 3);
        assert!(
            created
                .iter()
                .any(|category| category.color.as_deref() == Some("#DB1313"))
        );
    }

    #[tokio::test]
    async fn test_create_category_preserves_child_color() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_parent = repo.create_category(parent).await.unwrap();

        let child = NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(created_parent.id.clone()),
            description: None,
            color: Some("#3C99F6".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_child = repo.create_category(child).await.unwrap();

        assert_eq!(created_child.color.as_deref(), Some("#3C99F6"));
    }

    #[tokio::test]
    async fn test_create_category_preserves_missing_child_color() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_parent = repo.create_category(parent).await.unwrap();

        let child = NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(created_parent.id),
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_child = repo.create_category(child).await.unwrap();

        assert_eq!(created_child.color, None);
    }

    #[tokio::test]
    async fn test_update_category_preserves_child_color() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_parent = repo.create_category(parent).await.unwrap();

        let child = NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(created_parent.id.clone()),
            description: None,
            color: Some("#DB1313".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_child = repo.create_category(child).await.unwrap();

        let updated_child = TransactionCategoryUpdate {
            id: created_child.id,
            name: "Child Updated".to_string(),
            parent_id: Some(created_parent.id),
            description: None,
            color: Some("#AB63F2".to_string()),
            role: None,
        };

        let updated_child = repo.update_category(updated_child).await.unwrap();

        assert_eq!(updated_child.color.as_deref(), Some("#AB63F2"));
    }

    #[tokio::test]
    async fn test_update_category_keeps_root_color_when_parent_is_removed() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_parent = repo.create_category(parent).await.unwrap();

        let child = NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(created_parent.id.clone()),
            description: None,
            color: Some("#DB1313".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_child = repo.create_category(child).await.unwrap();

        let updated_child = TransactionCategoryUpdate {
            id: created_child.id,
            name: "Promoted Child".to_string(),
            parent_id: None,
            description: None,
            color: Some("#AB63F2".to_string()),
            role: None,
        };

        let updated_child = repo.update_category(updated_child).await.unwrap();

        assert_eq!(updated_child.color.as_deref(), Some("#AB63F2"));
    }

    #[tokio::test]
    async fn test_sibling_name_exists_compares_trimmed_names_case_insensitively() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        repo.create_category(NewTransactionCategory {
            name: "Food".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        })
        .await
        .unwrap();

        let exists = repo
            .sibling_name_exists(None, " food ", None)
            .expect("check sibling name");

        assert!(exists);
    }

    #[tokio::test]
    async fn test_delete_parent_category_promotes_children() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = repo
            .create_category(NewTransactionCategory {
                name: "Parent".to_string(),
                parent_id: None,
                description: None,
                color: None,
                role: None,
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();
        let child = repo
            .create_category(NewTransactionCategory {
                name: "Child".to_string(),
                parent_id: Some(parent.id.clone()),
                description: None,
                color: None,
                role: None,
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();

        repo.delete_categories(vec![&parent.id], CategoryChildrenDeleteStrategy::Promote)
            .await
            .unwrap();
        let promoted = repo.get_category(&child.id).unwrap();

        assert!(promoted.parent_id.is_none());
    }

    #[tokio::test]
    async fn test_delete_parent_category_deletes_children() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = repo
            .create_category(NewTransactionCategory {
                name: "Parent".to_string(),
                parent_id: None,
                description: None,
                color: None,
                role: None,
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();
        let child = repo
            .create_category(NewTransactionCategory {
                name: "Child".to_string(),
                parent_id: Some(parent.id.clone()),
                description: None,
                color: None,
                role: None,
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();

        let deleted = repo
            .delete_categories(vec![&parent.id], CategoryChildrenDeleteStrategy::Delete)
            .await
            .unwrap();

        assert!(deleted.iter().any(|category| category.id == child.id));
    }

    #[tokio::test]
    async fn test_delete_category_uncategorizes_transactions() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let category = repo
            .create_category(NewTransactionCategory {
                name: "Food".to_string(),
                parent_id: None,
                description: None,
                color: None,
                role: None,
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();
        insert_transaction_with_category(&repo, &category.id);

        repo.delete_categories(vec![&category.id], CategoryChildrenDeleteStrategy::Block)
            .await
            .unwrap();
        let conn = &mut get_connection(&repo.pool).unwrap();
        let category_id = transactions::table
            .select(transactions::transaction_category_id)
            .first::<Option<String>>(conn)
            .unwrap();

        assert!(category_id.is_none());
    }
}
