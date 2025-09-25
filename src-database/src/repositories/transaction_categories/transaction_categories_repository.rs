use super::transaction_categories_traits::TransactionCategoriesRepositoryTrait;
use crate::database::{get_connection, WriteHandle};
use crate::errors::{Error, Result};
use crate::repositories::transaction_categories::transaction_categories_errors::TransactionCategoryError;
use crate::repositories::transaction_categories::transaction_categories_models::{
    NewTransactionCategory, TransactionCategory,
};
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
    fn get_category(&self, id: &str) -> Result<TransactionCategory> {
        let mut conn = get_connection(&self.pool)?;

        let result = transaction_categories::table
            .find(id)
            .first::<TransactionCategory>(&mut conn)
            .map_err(|e| Error::from(TransactionCategoryError::NotFound(e.to_string())))?;

        Ok(result.into())
    }
    fn get_all_categories(&self) -> crate::errors::Result<Vec<TransactionCategory>> {
        let mut conn = get_connection(&self.pool)?;

        let result = transaction_categories::table.load::<TransactionCategory>(&mut conn)?;

        Ok(result.into())
    }

    fn get_children(&self, parent_id: &str) -> Result<Vec<TransactionCategory>> {
        let mut conn = get_connection(&self.pool)?;

        let result = transaction_categories::table
            .filter(transaction_categories::parent_id.eq(parent_id))
            .load::<TransactionCategory>(&mut conn)?;

        Ok(result.into())
    }

    async fn create_category(
        &self,
        new_category: NewTransactionCategory,
    ) -> Result<TransactionCategory> {
        new_category.validate()?;

        let new_category = new_category.clone();
        let new_id = Uuid::new_v4().to_string();

        self.writer
            .exec(move |conn: &mut SqliteConnection| -> Result<TransactionCategory> {
                let mut category_to_insert = new_category;
                category_to_insert.id = Some(new_id.clone());

                diesel::insert_into(transaction_categories::table)
                    .values(&category_to_insert)
                    .execute(conn)?;

                let inserted = transaction_categories::table
                    .filter(transaction_categories::id.eq(&new_id))
                    .first::<TransactionCategory>(conn)?;

                Ok(inserted)
            })
            .await
    }

    async fn update_category(
        &self,
        updated_category: TransactionCategory,
    ) -> Result<TransactionCategory> {
        let category_id_owned = updated_category.id.clone();
        let updated_category_owned = updated_category.clone();

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> Result<TransactionCategory> {
                    diesel::update(transaction_categories::table.find(category_id_owned.clone()))
                        .set(&updated_category_owned)
                        .execute(conn)?;
                    Ok(transaction_categories::table
                        .filter(transaction_categories::id.eq(category_id_owned))
                        .first(conn)?)
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

                    Ok(transaction_categories::table
                        .filter(transaction_categories::id.eq(&category_id))
                        .first(conn)?)
                },
            )
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{run_migrations};
    use crate::repositories::transaction_categories::transaction_categories_models::{
        NewTransactionCategory, TransactionCategory,
    };
    use tokio;
    use crate::database;
    use crate::database::write_actor::spawn_writer;


    fn setup_test_repo(db_path: &str) -> TransactionCategoriesRepository {
        let manager = r2d2::ConnectionManager::<SqliteConnection>::new(db_path);
        let pool = Pool::builder().build(manager).expect("Failed to create pool");

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
        assert!(created.deleted_at.is_none());
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

        let mut updated = created.clone();
        updated.name = "Updated".to_string();
        updated.description = Some("Updated description".to_string());

        let updated_category = repo.update_category(updated).await.unwrap();

        assert_eq!(updated_category.name, "Updated");
        assert_eq!(updated_category.description.as_deref(), Some("Updated description"));
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

        assert!(deleted.deleted_at.is_some());
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

        let children = repo.get_children(&parent.id).unwrap();
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

        let all = repo.get_all_categories().unwrap();
        assert!(all.len() >= 2);
    }
}
