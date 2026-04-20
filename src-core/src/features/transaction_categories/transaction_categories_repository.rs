use super::transaction_categories_traits::TransactionCategoriesRepositoryTrait;
use crate::database::{WriteHandle, get_connection};
use crate::errors::{Error, Result};
use crate::features::transaction_categories::transaction_categories_models::NewTransactionCategory;
use crate::features::transaction_categories::transaction_categories_models::*;
use crate::schema::transaction_categories;
use async_trait::async_trait;
use chrono::Local;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use uuid::Uuid;

pub struct TransactionCategoriesRepository {
    pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
    writer: WriteHandle,
}

impl TransactionCategoriesRepository {
    pub fn new(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
    ) -> Self {
        Self { pool, writer }
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

        let results =
            query.load::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)?;

        let categories: Vec<TransactionCategory> = results
            .into_iter()
            .map(|(row, parent_row)| {
                let mut category: TransactionCategory = row.into();
                category.parent = parent_row.map(TransactionCategory::from).map(Box::new);
                category
            })
            .collect();

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
            .map_err(|e| Error::NotFound(e.to_string()))?;

        let mut category: TransactionCategory = category_row.into();
        category.parent = parent_row.map(TransactionCategory::from).map(Box::new);

        Ok(category)
    }

    async fn create_category(
        &self,
        new_category: NewTransactionCategory,
    ) -> Result<TransactionCategory> {
        new_category.validate()?;

        let new_category = new_category.clone();
        let new_id = Uuid::new_v4().to_string();

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> Result<TransactionCategory> {
                    // Validate nesting level before creating
                    if let Some(parent_id) = &new_category.parent_id {
                        let parent_row = transaction_categories::table
                            .find(parent_id.as_str())
                            .filter(transaction_categories::deleted_at.is_null())
                            .first::<TransactionCategoryRow>(conn)
                            .map_err(|e| Error::NotFound(e.to_string()))?;

                        if parent_row.parent_id.is_some() {
                            return Err(Error::InvalidData(
                                "Cannot create categories deeper than 2 levels. The parent category must be a root category."
                                    .to_string(),
                            ));
                        }
                    }

                    let mut category: TransactionCategoryRow = new_category.into();
                    category.id = new_id.clone();

                    diesel::insert_into(transaction_categories::table)
                        .values(&category)
                        .execute(conn)?;

                    let parent_categories =
                        diesel::alias!(transaction_categories as parent_categories);

                    let (category_row, parent_row) = transaction_categories::table
                        .left_join(
                            parent_categories.on(
                                transaction_categories::parent_id.eq(parent_categories
                                    .field(transaction_categories::id)
                                    .nullable()),
                            ),
                        )
                        .filter(transaction_categories::id.eq(&new_id))
                        .first::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)?;

                    let mut category: TransactionCategory = category_row.into();
                    category.parent = parent_row.map(TransactionCategory::from).map(Box::new);

                    Ok(category)
                },
            )
            .await
    }

    async fn update_category(
        &self,
        updated_category: TransactionCategoryUpdate,
    ) -> Result<TransactionCategory> {
        updated_category.validate()?;

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> Result<TransactionCategory> {
                    // Validate nesting level before updating
                    if let Some(parent_id) = &updated_category.parent_id {
                        let parent_row = transaction_categories::table
                            .find(parent_id.as_str())
                            .filter(transaction_categories::deleted_at.is_null())
                            .first::<TransactionCategoryRow>(conn)
                            .map_err(|e| Error::NotFound(e.to_string()))?;

                        if parent_row.parent_id.is_some() {
                            return Err(Error::InvalidData(
                                "Cannot create categories deeper than 2 levels. The parent category must be a root category."
                                    .to_string(),
                            ));
                        }
                    }

                    let mut category: TransactionCategoryRow = updated_category.into();

                    let existing = transaction_categories::table
                        .find(&category.id)
                        .first::<TransactionCategoryRow>(conn)
                        .map_err(|e| Error::NotFound(e.to_string()))?;

                    category.created_at = existing.created_at;
                    category.updated_at = chrono::Utc::now().naive_utc();

                    diesel::update(transaction_categories::table.find(&category.id))
                        .set(&category)
                        .execute(conn)?;

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
                        .first::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)?;

                    let mut category: TransactionCategory = category_row.into();
                    category.parent = parent_row.map(TransactionCategory::from).map(Box::new);

                    Ok(category)
                },
            )
            .await
    }

    async fn delete_categories(&self, ids: Vec<&str>) -> Result<Vec<TransactionCategory>> {
        let owned_ids = ids.iter().map(|&s| s.to_string()).collect::<Vec<String>>();
        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> Result<Vec<TransactionCategory>> {
                    let now = Local::now().naive_utc();

                    diesel::update(
                        transaction_categories::table
                            .filter(transaction_categories::id.eq_any(&owned_ids)),
                    )
                    .set(transaction_categories::deleted_at.eq(now))
                    .execute(conn)?;

                    let deleted = transaction_categories::table
                        .filter(transaction_categories::id.eq_any(&owned_ids))
                        .filter(transaction_categories::deleted_at.is_not_null())
                        .load::<TransactionCategoryRow>(conn)?;

                    let categories: Vec<TransactionCategory> =
                        deleted.into_iter().map(TransactionCategory::from).collect();
                    Ok(categories)
                },
            )
            .await
    }

    async fn import_categories(
        &self,
        new_categories: Vec<NewTransactionCategory>,
    ) -> Result<Vec<TransactionCategory>> {
        let valid_categories = new_categories
            .iter()
            .filter(|c| c.validate().is_ok())
            .cloned()
            .collect::<Vec<_>>();

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> Result<Vec<TransactionCategory>> {
                    let categories: Vec<TransactionCategoryRow> =
                        valid_categories.iter().map(|c| c.clone().into()).collect();

                    diesel::insert_into(transaction_categories::table)
                        .values(&categories)
                        .execute(conn)?;

                    let ids = categories
                        .iter()
                        .map(|c| c.id.clone())
                        .collect::<Vec<String>>();

                    let inserted = transaction_categories::table
                        .filter(transaction_categories::id.eq_any(&ids))
                        .load::<TransactionCategoryRow>(conn)?;

                    Ok(inserted
                        .into_iter()
                        .map(TransactionCategory::from)
                        .collect())
                },
            )
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database;
    use crate::database::run_migrations;
    use crate::database::write_actor::spawn_writer;
    use crate::features::transaction_categories::transaction_categories_models::{
        NewTransactionCategory, TransactionCategory,
    };
    use tokio;

    fn setup_test_repo(db_path: &str) -> TransactionCategoriesRepository {
        let manager = r2d2::ConnectionManager::<SqliteConnection>::new(db_path);
        let pool = Pool::builder()
            .build(manager)
            .expect("Failed to create pool");

        run_migrations(&pool.clone()).unwrap();

        let writer = spawn_writer(pool.clone());

        TransactionCategoriesRepository::new(Arc::new(pool), writer)
    }

    #[tokio::test]
    async fn test_get_categories() {
        let temp_db = database::TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let cat1 = NewTransactionCategory {
            name: "Cat 1".to_string(),
            parent_id: None,
            description: None,
            color: None,
            id: None,
        };
        let cat2 = NewTransactionCategory {
            name: "Cat 2".to_string(),
            parent_id: None,
            description: None,
            color: None,
            id: None,
        };
        let cat3 = NewTransactionCategory {
            name: "Cat 3".to_string(),
            parent_id: None,
            description: None,
            color: None,
            id: None,
        };

        repo.create_category(cat1).await.unwrap();
        repo.create_category(cat2).await.unwrap();
        let created = repo.create_category(cat3).await.unwrap();
        repo.delete_categories(vec![&created.id]).await.unwrap();

        let all = repo.get_categories(None).unwrap();
        assert!(all.len() == 2);
    }

    #[tokio::test]
    async fn test_get_category() {
        let temp_db = database::TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: None,
            id: None,
        };
        let parent = repo.create_category(parent).await.unwrap();

        let child = NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: None,
            id: None,
        };
        let child = repo.create_category(child).await.unwrap();

        let category = repo.get_category(&child.id).unwrap();
        assert_eq!(category.id, child.id);
        assert_eq!(category.parent.unwrap().id, parent.id);
    }

    #[tokio::test]
    async fn test_get_categories_by_parent_id() {
        let temp_db = database::TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        // Create a parent first
        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: None,
            id: None,
        };
        let parent = repo.create_category(parent).await.unwrap();

        let cat1 = NewTransactionCategory {
            name: "Cat 1".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: None,
            id: None,
        };
        let cat2 = NewTransactionCategory {
            name: "Cat 2".to_string(),
            parent_id: None,
            description: None,
            color: None,
            id: None,
        };
        let cat3 = NewTransactionCategory {
            name: "Cat 3".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: None,
            id: None,
        };

        repo.create_category(cat1).await.unwrap();
        repo.create_category(cat2).await.unwrap();
        let created = repo.create_category(cat3).await.unwrap();
        repo.delete_categories(vec![&created.id]).await.unwrap();

        let all = repo.get_categories(Some(&parent.id)).unwrap();
        assert!(all.len() == 1);
        assert!(all[0].name == "Cat 1");
    }

    #[tokio::test]
    async fn test_create_category() {
        let temp_db = database::TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category = NewTransactionCategory {
            name: "Test Category".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            id: None,
        };

        let created: TransactionCategory = repo.create_category(new_category).await.unwrap();

        assert!(!created.id.is_empty());
        assert_eq!(created.name, "Test Category");
        assert_eq!(created.description.as_deref(), Some("Descrizione test"));
        assert_eq!(created.color.as_deref(), Some("#FF0000"));
    }

    #[tokio::test]
    async fn test_update_category() {
        let temp_db = database::TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category = NewTransactionCategory {
            name: "Original".to_string(),
            parent_id: None,
            description: None,
            color: None,
            id: None,
        };
        let created = repo.create_category(new_category).await.unwrap();

        let updated = TransactionCategoryUpdate {
            id: created.id,
            name: "Updated".to_string(),
            parent_id: None,
            description: Some("Updated description".to_string()),
            color: None,
        };

        let updated_category = repo.update_category(updated).await.unwrap();

        assert_eq!(updated_category.name, "Updated");
        assert_eq!(
            updated_category.description.as_deref(),
            Some("Updated description")
        );
    }

    #[tokio::test]
    async fn test_delete_categories() {
        let temp_db = database::TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category_1 = NewTransactionCategory {
            name: "To Delete".to_string(),
            parent_id: None,
            description: None,
            color: None,
            id: None,
        };
        let created_1 = repo.create_category(new_category_1).await.unwrap();

        let new_category_2 = NewTransactionCategory {
            name: "To Delete".to_string(),
            parent_id: None,
            description: None,
            color: None,
            id: None,
        };
        let created_2 = repo.create_category(new_category_2).await.unwrap();

        let deleted = repo
            .delete_categories(vec![&created_1.id, &created_2.id])
            .await
            .unwrap();

        assert_eq!(deleted.len(), 2);
    }

    #[tokio::test]
    async fn test_import_categories() {
        let temp_db = database::TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category_1 = NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            name: "Test Category 1".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
        };

        let new_category_2 = NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            name: "Test Category 2".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
        };

        let new_category_3 = NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            name: "Test Category 3".to_string(),
            parent_id: Some(new_category_1.id.as_deref().unwrap().to_string()),
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
        };

        let created: Vec<TransactionCategory> = repo
            .import_categories(vec![new_category_1, new_category_2, new_category_3])
            .await
            .unwrap();

        assert!(created.len() == 3);
    }
}
