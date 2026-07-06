use super::models::{
    CategoryChildrenDeleteStrategy, NewTransactionCategory, TransactionCategory,
    TransactionCategoryUpdate, normalize_category_name, normalize_optional_color,
};
use super::traits::{TransactionCategoriesRepositoryTrait, TransactionCategoriesServiceTrait};
use crate::errors::{Error, Result};
use std::sync::Arc;
use uuid::Uuid;

pub struct TransactionCategoriesService {
    repository: Arc<dyn TransactionCategoriesRepositoryTrait>,
}

impl TransactionCategoriesService {
    pub fn new(repository: Arc<dyn TransactionCategoriesRepositoryTrait>) -> Self {
        Self { repository }
    }

    fn prepare_new_category(&self, category: &mut NewTransactionCategory) -> Result<()> {
        category.name = normalize_category_name(&category.name);
        category.validate()?;
        if category.id.as_deref().is_none_or(|id| id.trim().is_empty()) {
            category.id = Some(Uuid::new_v4().to_string());
        }
        self.apply_parent_rules(None, &mut category.parent_id, &mut category.color)?;
        self.ensure_unique_name(category.parent_id.as_deref(), &category.name, None)
    }

    fn prepare_category_update(&self, category: &mut TransactionCategoryUpdate) -> Result<()> {
        category.name = normalize_category_name(&category.name);
        category.validate()?;
        self.apply_parent_rules(
            Some(category.id.as_str()),
            &mut category.parent_id,
            &mut category.color,
        )?;
        self.ensure_unique_name(
            category.parent_id.as_deref(),
            &category.name,
            Some(category.id.as_str()),
        )
    }

    fn apply_parent_rules(
        &self,
        category_id: Option<&str>,
        parent_id: &mut Option<String>,
        color: &mut Option<String>,
    ) -> Result<()> {
        let Some(pid) = parent_id.as_deref().filter(|id| !id.trim().is_empty()) else {
            *parent_id = None;
            *color = normalize_optional_color(color.as_deref())?;
            return Ok(());
        };

        if let Some(id) = category_id
            && self.repository.category_has_children(id)?
        {
            return Err(Error::InvalidData(
                "A category with child categories cannot become a child category".to_string(),
            ));
        }

        let parent = self.repository.get_category(pid)?;
        if parent.parent_id.is_some() {
            return Err(Error::InvalidData(
                "Cannot create categories deeper than 2 levels. The parent category must be a root category."
                    .to_string(),
            ));
        }

        *parent_id = Some(parent.id);
        *color = normalize_optional_color(color.as_deref())?;
        Ok(())
    }

    fn ensure_unique_name(
        &self,
        parent_id: Option<&str>,
        name: &str,
        excluded_id: Option<&str>,
    ) -> Result<()> {
        if self
            .repository
            .sibling_name_exists(parent_id, name, excluded_id)?
        {
            return Err(Error::InvalidData(
                "A category with this name already exists at the same level".to_string(),
            ));
        }
        Ok(())
    }
}

#[async_trait::async_trait]
impl TransactionCategoriesServiceTrait for TransactionCategoriesService {
    fn get_categories(&self, parent_id: Option<&str>) -> Result<Vec<TransactionCategory>> {
        self.repository.get_categories(parent_id)
    }

    fn get_category(&self, category_id: &str) -> Result<TransactionCategory> {
        self.repository.get_category(category_id)
    }

    async fn create_category(
        &self,
        mut category: NewTransactionCategory,
    ) -> Result<TransactionCategory> {
        self.prepare_new_category(&mut category)?;
        self.repository.create_category(category).await
    }

    async fn update_category(
        &self,
        mut category: TransactionCategoryUpdate,
    ) -> Result<TransactionCategory> {
        self.prepare_category_update(&mut category)?;
        self.repository.update_category(category).await
    }

    async fn delete_categories(
        &self,
        category_ids: Vec<&str>,
        children_strategy: CategoryChildrenDeleteStrategy,
    ) -> Result<Vec<TransactionCategory>> {
        if children_strategy == CategoryChildrenDeleteStrategy::Block {
            for category_id in &category_ids {
                if self.repository.category_has_children(category_id)? {
                    return Err(Error::InvalidData(
                        "Choose whether to delete or promote child categories before deleting this category"
                            .to_string(),
                    ));
                }
            }
        }

        self.repository
            .delete_categories(category_ids, children_strategy)
            .await
    }

    async fn import_categories(
        &self,
        categories: Vec<NewTransactionCategory>,
    ) -> Result<Vec<TransactionCategory>> {
        for category in &categories {
            let mut category = category.clone();
            category.name = normalize_category_name(&category.name);
            category.validate()?;
        }

        let mut categories_to_import = Vec::with_capacity(categories.len());

        for root_category in categories
            .iter()
            .filter(|category| is_root_category(category))
        {
            let original_root_id = root_category.id.clone();
            let new_parent_id = Uuid::new_v4().to_string();
            let parent_color = normalize_optional_color(root_category.color.as_deref())?;

            let mut owned_root = root_category.clone();
            owned_root.id = Some(new_parent_id.clone());
            owned_root.parent_id = None;
            owned_root.name = normalize_category_name(&owned_root.name);
            owned_root.color = parent_color.clone();
            categories_to_import.push(owned_root);

            for child in categories.iter().filter(|category| {
                category.parent_id.is_some()
                    && category.parent_id.as_deref() == original_root_id.as_deref()
            }) {
                let mut owned_child = child.clone();
                owned_child.id = Some(Uuid::new_v4().to_string());
                owned_child.parent_id = Some(new_parent_id.clone());
                owned_child.name = normalize_category_name(&owned_child.name);
                owned_child.color = normalize_optional_color(owned_child.color.as_deref())?;
                categories_to_import.push(owned_child);
            }
        }

        if categories_to_import.len() != categories.len() {
            return Err(Error::InvalidData(
                "Cannot import a child category without its root category".to_string(),
            ));
        }

        self.repository
            .import_categories(categories_to_import)
            .await
    }
}

fn is_root_category(category: &NewTransactionCategory) -> bool {
    category
        .parent_id
        .as_deref()
        .is_none_or(|parent_id| parent_id.trim().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;
    use std::sync::Mutex;

    #[derive(Default)]
    struct FakeRepository {
        categories: Mutex<Vec<TransactionCategory>>,
    }

    impl FakeRepository {
        fn with_categories(categories: Vec<TransactionCategory>) -> Self {
            Self {
                categories: Mutex::new(categories),
            }
        }
    }

    #[async_trait::async_trait]
    impl TransactionCategoriesRepositoryTrait for FakeRepository {
        fn get_categories(&self, parent_id: Option<&str>) -> Result<Vec<TransactionCategory>> {
            let categories = self.categories.lock().unwrap();
            Ok(categories
                .iter()
                .filter(|category| {
                    parent_id.is_none_or(|id| category.parent_id.as_deref() == Some(id))
                })
                .cloned()
                .collect())
        }

        fn get_category(&self, id: &str) -> Result<TransactionCategory> {
            self.categories
                .lock()
                .unwrap()
                .iter()
                .find(|category| category.id == id)
                .cloned()
                .ok_or_else(|| Error::NotFound(id.to_string()))
        }

        fn category_has_children(&self, id: &str) -> Result<bool> {
            Ok(self
                .categories
                .lock()
                .unwrap()
                .iter()
                .any(|category| category.parent_id.as_deref() == Some(id)))
        }

        fn sibling_name_exists(
            &self,
            parent_id: Option<&str>,
            name: &str,
            excluded_id: Option<&str>,
        ) -> Result<bool> {
            let normalized_name = name.trim().to_lowercase();
            Ok(self.categories.lock().unwrap().iter().any(|category| {
                category.parent_id.as_deref() == parent_id
                    && Some(category.id.as_str()) != excluded_id
                    && category.name.trim().to_lowercase() == normalized_name
            }))
        }

        async fn create_category(
            &self,
            new_category: NewTransactionCategory,
        ) -> Result<TransactionCategory> {
            let category = TransactionCategory {
                id: new_category.id.unwrap(),
                parent_id: new_category.parent_id,
                name: new_category.name,
                description: new_category.description,
                color: new_category.color,
                parent: None,
            };
            self.categories.lock().unwrap().push(category.clone());
            Ok(category)
        }

        async fn update_category(
            &self,
            updated_category: TransactionCategoryUpdate,
        ) -> Result<TransactionCategory> {
            let category = TransactionCategory {
                id: updated_category.id,
                parent_id: updated_category.parent_id,
                name: updated_category.name,
                description: updated_category.description,
                color: updated_category.color,
                parent: None,
            };
            Ok(category)
        }

        async fn delete_categories(
            &self,
            ids: Vec<&str>,
            _children_strategy: CategoryChildrenDeleteStrategy,
        ) -> Result<Vec<TransactionCategory>> {
            Ok(self
                .categories
                .lock()
                .unwrap()
                .iter()
                .filter(|category| ids.contains(&category.id.as_str()))
                .cloned()
                .collect())
        }

        async fn import_categories(
            &self,
            categories: Vec<NewTransactionCategory>,
        ) -> Result<Vec<TransactionCategory>> {
            Ok(categories
                .into_iter()
                .map(|category| TransactionCategory {
                    id: category.id.unwrap(),
                    parent_id: category.parent_id,
                    name: category.name,
                    description: category.description,
                    color: category.color,
                    parent: None,
                })
                .collect())
        }
    }

    #[tokio::test]
    async fn create_category_preserves_child_color() {
        let repository = Arc::new(FakeRepository::with_categories(vec![TransactionCategory {
            id: "parent".to_string(),
            parent_id: None,
            name: "Parent".to_string(),
            description: None,
            color: Some("#FFFFFF".to_string()),
            parent: None,
        }]));
        let service = TransactionCategoriesService::new(repository);

        let category = service
            .create_category(NewTransactionCategory {
                id: None,
                name: "Child".to_string(),
                parent_id: Some("parent".to_string()),
                description: None,
                color: Some("#000000".to_string()),
            })
            .await
            .unwrap();

        assert_eq!(category.color.as_deref(), Some("#000000"));
    }

    #[tokio::test]
    async fn import_categories_preserves_child_color() {
        let service = TransactionCategoriesService::new(Arc::new(FakeRepository::default()));
        let parent = NewTransactionCategory {
            id: Some("parent1".to_string()),
            name: "Parent Category".to_string(),
            parent_id: None,
            description: Some("Parent description".to_string()),
            color: Some("#D31212".to_string()),
        };
        let child = NewTransactionCategory {
            id: Some("child1".to_string()),
            name: "Child Category".to_string(),
            parent_id: Some("parent1".to_string()),
            description: Some("Child description".to_string()),
            color: None,
        };

        let imported = service
            .import_categories(vec![parent, child])
            .await
            .unwrap();
        let imported_parent = imported
            .iter()
            .find(|category| category.parent_id.is_none())
            .unwrap();
        let imported_child = imported
            .iter()
            .find(|category| category.parent_id.as_deref() == Some(imported_parent.id.as_str()))
            .unwrap();

        assert_eq!(imported_child.color, None);
    }

    #[tokio::test]
    async fn import_categories_fails_on_invalid_category() {
        let service = TransactionCategoriesService::new(Arc::new(FakeRepository::default()));

        let result = service
            .import_categories(vec![NewTransactionCategory {
                id: Some("bad".to_string()),
                name: "".to_string(),
                parent_id: None,
                description: None,
                color: None,
            }])
            .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn create_category_fails_when_root_name_matches_existing_root_case_insensitively() {
        let repository = Arc::new(FakeRepository::with_categories(vec![TransactionCategory {
            id: "existing".to_string(),
            parent_id: None,
            name: "Food".to_string(),
            description: None,
            color: None,
            parent: None,
        }]));
        let service = TransactionCategoriesService::new(repository);

        let result = service
            .create_category(NewTransactionCategory {
                id: None,
                name: " food ".to_string(),
                parent_id: None,
                description: None,
                color: None,
            })
            .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn update_category_fails_when_category_with_children_gets_parent() {
        let repository = Arc::new(FakeRepository::with_categories(vec![
            TransactionCategory {
                id: "parent".to_string(),
                parent_id: None,
                name: "Parent".to_string(),
                description: None,
                color: None,
                parent: None,
            },
            TransactionCategory {
                id: "target".to_string(),
                parent_id: None,
                name: "Target".to_string(),
                description: None,
                color: None,
                parent: None,
            },
            TransactionCategory {
                id: "child".to_string(),
                parent_id: Some("target".to_string()),
                name: "Child".to_string(),
                description: None,
                color: None,
                parent: None,
            },
        ]));
        let service = TransactionCategoriesService::new(repository);

        let result = service
            .update_category(TransactionCategoryUpdate {
                id: "target".to_string(),
                name: "Target".to_string(),
                parent_id: Some("parent".to_string()),
                description: None,
                color: None,
            })
            .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn delete_category_blocks_when_children_exist_without_strategy() {
        let repository = Arc::new(FakeRepository::with_categories(vec![
            TransactionCategory {
                id: "parent".to_string(),
                parent_id: None,
                name: "Parent".to_string(),
                description: None,
                color: None,
                parent: None,
            },
            TransactionCategory {
                id: "child".to_string(),
                parent_id: Some("parent".to_string()),
                name: "Child".to_string(),
                description: None,
                color: None,
                parent: None,
            },
        ]));
        let service = TransactionCategoriesService::new(repository);

        let result = service
            .delete_categories(vec!["parent"], CategoryChildrenDeleteStrategy::Block)
            .await;

        assert!(result.is_err());
    }
}
