use super::transaction_categories_traits::TransactionCategoriesRepositoryTrait;
use crate::database::{WriteHandle, get_connection};
use crate::errors::{Error, Result};
use crate::features::transaction_categories::transaction_categories_errors::TransactionCategoryError;
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
    fn get_categories(&self) -> Result<Vec<TransactionCategory>> {
        let mut conn = get_connection(&self.pool)?;

        let results = transaction_categories::table.load::<TransactionCategoryTable>(&mut conn)?;

        let categories: Vec<TransactionCategory> =
            results.into_iter().map(TransactionCategory::from).collect();
        Ok(categories)
    }

    fn get_category(&self, id: &str) -> Result<TransactionCategory> {
        let mut conn = get_connection(&self.pool)?;

        let result = transaction_categories::table
            .find(id)
            .first::<TransactionCategoryTable>(&mut conn)
            .map_err(|e| Error::from(TransactionCategoryError::NotFound(e.to_string())))?;

        Ok(result.into())
    }

    fn get_categories_by_parent_id(&self, parent_id: &str) -> Result<Vec<TransactionCategory>> {
        let mut conn = get_connection(&self.pool)?;

        let results = transaction_categories::table
            .filter(transaction_categories::parent_id.eq(parent_id))
            .load::<TransactionCategoryTable>(&mut conn)?;

        let categories: Vec<TransactionCategory> =
            results.into_iter().map(TransactionCategory::from).collect();
        Ok(categories)
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
                    let mut category: TransactionCategoryTable = new_category.into();
                    category.id = new_id.clone();

                    diesel::insert_into(transaction_categories::table)
                        .values(&category)
                        .execute(conn)?;

                    let inserted = transaction_categories::table
                        .filter(transaction_categories::id.eq(&new_id))
                        .first::<TransactionCategoryTable>(conn)?;

                    Ok(inserted.into())
                },
            )
            .await
    }

    async fn update_category(
        &self,
        updated_category: NewTransactionCategory,
    ) -> Result<TransactionCategory> {
        updated_category.validate()?;

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> Result<TransactionCategory> {
                    let mut category: TransactionCategoryTable = updated_category.into();

                    let existing = transaction_categories::table
                        .find(&category.id)
                        .first::<TransactionCategoryTable>(conn)
                        .map_err(|e| {
                            Error::from(TransactionCategoryError::NotFound(e.to_string()))
                        })?;

                    category.created_at = existing.created_at;
                    category.updated_at = chrono::Utc::now().naive_utc();

                    diesel::update(transaction_categories::table.find(&category.id))
                        .set(&category)
                        .execute(conn)?;

                    Ok(category.into())
                },
            )
            .await
    }

    async fn delete_category(&self, id: &str) -> Result<TransactionCategory> {
        let category_id = id.to_owned();

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> Result<TransactionCategory> {
                    let now = Local::now().naive_utc();

                    diesel::update(transaction_categories::table.find(&category_id))
                        .set(transaction_categories::deleted_at.eq(now))
                        .execute(conn)?;

                    let deleted = transaction_categories::table
                        .find(&category_id)
                        .filter(transaction_categories::deleted_at.is_not_null())
                        .first::<TransactionCategoryTable>(conn)?;

                    Ok(deleted.into())
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

        let updated = NewTransactionCategory {
            name: "Updated".to_string(),
            parent_id: None,
            description: Some("Updated description".to_string()),
            color: None,
            id: Some(created.id),
        };

        let updated_category = repo.update_category(updated).await.unwrap();

        assert_eq!(updated_category.name, "Updated");
        assert_eq!(
            updated_category.description.as_deref(),
            Some("Updated description")
        );
    }

    #[tokio::test]
    async fn test_delete_category() {
        let temp_db = database::TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category = NewTransactionCategory {
            name: "To Delete".to_string(),
            parent_id: None,
            description: None,
            color: None,
            id: None,
        };
        let created = repo.create_category(new_category).await.unwrap();

        let deleted = repo.delete_category(&created.id).await.unwrap();

        assert_eq!(created.id, deleted.id);
    }

    #[tokio::test]
    async fn test_get_children() {
        let temp_db = database::TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        // Crea parent
        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: None,
            id: None,
        };
        let parent = repo.create_category(parent).await.unwrap();

        // Crea child
        let child = NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: None,
            id: None,
        };
        let _child = repo.create_category(child).await.unwrap();

        let children = repo.get_categories_by_parent_id(&parent.id).unwrap();
        assert_eq!(children.len(), 1);
        assert_eq!(children[0].name, "Child");
    }

    #[tokio::test]
    async fn test_get_all_categories() {
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

        repo.create_category(cat1).await.unwrap();
        repo.create_category(cat2).await.unwrap();

        let all = repo.get_categories().unwrap();
        assert!(all.len() >= 2);
    }
}
