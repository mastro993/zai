use uuid::Uuid;

use super::transaction_categories_models::TransactionCategory;
use super::transaction_categories_traits::{
    TransactionCategoriesRepositoryTrait, TransactionCategoriesServiceTrait,
};
use crate::errors::Result;
use crate::features::transaction_categories::transaction_categories_models::{
    NewTransactionCategory, TransactionCategoryUpdate,
};
use std::sync::Arc;

pub struct TransactionCategoriesService {
    repository: Arc<dyn TransactionCategoriesRepositoryTrait>,
}

impl TransactionCategoriesService {
    pub fn new(repository: Arc<dyn TransactionCategoriesRepositoryTrait>) -> Self {
        Self { repository }
    }
}

#[async_trait::async_trait]
impl TransactionCategoriesServiceTrait for TransactionCategoriesService {
    fn get_categories(&self, parent_id: Option<&str>) -> Result<Vec<TransactionCategory>> {
        (*self.repository).get_categories(parent_id)
    }

    fn get_category(&self, category_id: &str) -> Result<TransactionCategory> {
        (*self.repository).get_category(category_id)
    }

    async fn create_category(
        &self,
        category: NewTransactionCategory,
    ) -> Result<TransactionCategory> {
        (*self.repository).create_category(category).await
    }

    async fn update_category(
        &self,
        category: TransactionCategoryUpdate,
    ) -> Result<TransactionCategory> {
        (*self.repository).update_category(category).await
    }

    async fn delete_category(&self, category_id: &str) -> Result<TransactionCategory> {
        (*self.repository).delete_category(category_id).await
    }

    async fn delete_categories(&self, category_ids: Vec<&str>) -> Result<Vec<TransactionCategory>> {
        (*self.repository).delete_categories(category_ids).await
    }

    async fn import_categories(
        &self,
        categories: Vec<NewTransactionCategory>,
    ) -> Result<Vec<TransactionCategory>> {
        // Only categories that pass validation are imported; invalid ones are silently skipped.
        let valid_categories = categories
            .iter()
            .filter(|c| c.validate().is_ok())
            .collect::<Vec<_>>();

        let valid_count = valid_categories.len();
        let mut categories_to_import: Vec<NewTransactionCategory> = Vec::with_capacity(valid_count);

        // List of the root categories (categories with no parent)
        let root_categories = valid_categories
            .iter()
            .filter(|c| c.parent_id.is_none() || c.parent_id.as_deref() == Some(""))
            .cloned()
            .collect::<Vec<_>>();

        // For each parent category, create it and its children
        for root_category in root_categories {
            let mut owned_root_category = root_category.clone();
            let owned_parent_id = Some(Uuid::new_v4().to_string());

            owned_root_category.id = owned_parent_id.clone();
            owned_root_category.parent_id = None; // Ensure parent

            categories_to_import.push(owned_root_category);

            let child_categories = valid_categories
                .iter()
                .filter(|c| c.parent_id.is_some())
                .filter(|c| c.parent_id == root_category.id)
                .cloned() // get owned values
                .collect::<Vec<_>>();

            for child in child_categories {
                let mut owned_child = child.clone();

                owned_child.id = Some(Uuid::new_v4().to_string());
                owned_child.parent_id = owned_parent_id.clone();

                categories_to_import.push(owned_child);
            }
        }

        let created_categories = (*self.repository)
            .import_categories(categories_to_import)
            .await?;

        Ok(created_categories)
    }
}

#[cfg(test)]
mod tests {
    use super::TransactionCategoriesServiceTrait;
    use crate::database;
    use crate::database::run_migrations;
    use crate::database::write_actor::spawn_writer;
    use crate::features::transaction_categories::transaction_categories_models::NewTransactionCategory;
    use crate::features::transaction_categories::transaction_categories_repository::TransactionCategoriesRepository;
    use crate::features::transaction_categories::transaction_categories_service::TransactionCategoriesService;
    use diesel::SqliteConnection;
    use diesel::r2d2::{self, Pool};
    use std::sync::Arc;
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
    async fn test_import_categories() {
        let temp_db = database::TempDb::new();
        let repo = setup_test_repo(temp_db.path());
        let service = TransactionCategoriesService::new(Arc::new(repo));

        let parent = NewTransactionCategory {
            id: Some("parent1".to_string()),
            name: "Parent Category".to_string(),
            parent_id: None,
            description: Some("Parent description".to_string()),
            color: Some("#FFFFFF".to_string()),
        };
        let child_1 = NewTransactionCategory {
            id: Some("child1".to_string()),
            name: "Child Category".to_string(),
            parent_id: Some("parent1".to_string()),
            description: Some("Child description".to_string()),
            color: Some("#000000".to_string()),
        };
        let child_2 = NewTransactionCategory {
            id: Some("child2".to_string()),
            name: "Child Category".to_string(),
            parent_id: Some("parent1".to_string()),
            description: Some("Child description".to_string()),
            color: Some("#000000".to_string()),
        };

        let categories = vec![parent.clone(), child_1.clone(), child_2.clone()];
        let result = service.import_categories(categories).await;
        assert!(result.is_ok());
        assert!(result.unwrap().len() == 3);
    }
}
