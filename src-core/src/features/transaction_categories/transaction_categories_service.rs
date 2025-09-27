use super::transaction_categories_models::TransactionCategory;
use super::transaction_categories_traits::{
    TransactionCategoriesRepositoryTrait, TransactionCategoriesServiceTrait,
};
use crate::errors::Result;
use crate::features::transaction_categories::transaction_categories_models::NewTransactionCategory;
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
    fn get_categories(&self) -> Result<Vec<TransactionCategory>> {
        (*self.repository).get_categories()
    }
    fn get_category(&self, category_id: &str) -> Result<TransactionCategory> {
        (*self.repository).get_category(category_id)
    }
    async fn import_categories(
        &self,
        categories: Vec<NewTransactionCategory>,
    ) -> Result<Vec<TransactionCategory>> {
        let mut created_categories: Vec<TransactionCategory> = vec![];

        // Filter categories to only valid ones
        let valid_categories = categories
            .iter()
            .filter(|c| c.validate().is_ok())
            .cloned()
            .collect::<Vec<_>>();

        // List of the categories that have children
        let parent_categories = valid_categories
            .iter()
            .filter(|c| c.parent_id.is_none())
            .collect::<Vec<_>>();

        // For each parent category, create it and its children
        for parent in parent_categories {
            let created_parent = self.create_category(parent.clone()).await?;
            created_categories.push(created_parent.clone());

            let child_categories = valid_categories
                .iter()
                .filter(|c| c.parent_id.is_some())
                .filter(|c| c.parent_id == parent.id)
                .collect::<Vec<_>>();

            for child in child_categories {
                let owned_parent_id = created_parent.id.clone();
                let mut child_clone = child.clone();
                child_clone.parent_id = Some(owned_parent_id);
                let created_child = self.create_category(child_clone).await?;
                created_categories.push(created_child);
            }
        }

        Ok(created_categories)
    }
    async fn create_category(
        &self,
        category: NewTransactionCategory,
    ) -> Result<TransactionCategory> {
        (*self.repository).create_category(category).await
    }
    async fn update_category(
        &self,
        category: NewTransactionCategory,
    ) -> Result<TransactionCategory> {
        (*self.repository).update_category(category).await
    }
    async fn delete_category(&self, category_id: &str) -> Result<TransactionCategory> {
        (*self.repository).delete_category(category_id).await
    }
    async fn delete_categories(&self, category_ids: Vec<&str>) -> Result<Vec<TransactionCategory>> {
        (*self.repository).delete_categories(category_ids).await
    }
}

#[cfg(test)]
mod tests {
    use super::TransactionCategoriesServiceTrait;
    use crate::errors::Error;
    use crate::features::transaction_categories::transaction_categories_errors::TransactionCategoryError;
    // ...existing code...

    use crate::features::transaction_categories::{
        transaction_categories_service::TransactionCategoriesService,
        transaction_categories_traits::TransactionCategoriesRepositoryTrait,
    };

    use crate::errors::Result;
    use crate::features::transaction_categories::transaction_categories_models::{
        NewTransactionCategory, TransactionCategory,
    };
    use async_trait::async_trait;
    use std::sync::Arc;

    struct MockRepo {
        // ...existing code...
        pub created: Vec<NewTransactionCategory>,
    }

    #[async_trait]
    impl TransactionCategoriesRepositoryTrait for MockRepo {
        fn get_categories_by_parent_id(
            &self,
            _parent_id: &str,
        ) -> Result<Vec<TransactionCategory>> {
            Ok(vec![])
        }
        fn get_categories(&self) -> Result<Vec<TransactionCategory>> {
            Ok(vec![])
        }
        fn get_category(&self, _category_id: &str) -> Result<TransactionCategory> {
            Err(Error::from(TransactionCategoryError::NotFound(
                "mock not found".to_string(),
            )))
        }
        async fn create_category(
            &self,
            category: NewTransactionCategory,
        ) -> Result<TransactionCategory> {
            let mut created = self.created.clone();
            created.push(category.clone());
            Ok(TransactionCategory {
                id: category.id.clone().unwrap_or_default(),
                name: category.name.clone(),
                parent_id: category.parent_id.clone(),
                description: category.description.clone(),
                color: category.color.clone(),
            })
        }
        async fn update_category(
            &self,
            _category: NewTransactionCategory,
        ) -> Result<TransactionCategory> {
            Err(Error::from(TransactionCategoryError::NotFound(
                "mock not found".to_string(),
            )))
        }
        async fn delete_category(&self, _category_id: &str) -> Result<TransactionCategory> {
            Err(Error::from(TransactionCategoryError::NotFound(
                "mock not found".to_string(),
            )))
        }
        async fn delete_categories(
            &self,
            _category_ids: Vec<&str>,
        ) -> Result<Vec<TransactionCategory>> {
            Err(Error::from(TransactionCategoryError::NotFound(
                "mock not found".to_string(),
            )))
        }
    }

    #[tokio::test]
    async fn test_import_categories() {
        let repo = Arc::new(MockRepo { created: vec![] });
        let service = TransactionCategoriesService::new(repo.clone());

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
