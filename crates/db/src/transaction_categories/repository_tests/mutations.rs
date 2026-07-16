use super::*;

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
        confirm_budget_impact: false,
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
        confirm_budget_impact: false,
    })
    .await
    .unwrap();

    assert_eq!(
        repo.get_category(&child.id).await.unwrap().role,
        CategoryRole::Spending
    );
}

#[tokio::test]
async fn update_category_promotes_child_to_root_in_database() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let parent = repo
        .create_category(NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: Some(CategoryRole::Spending),
            id: Some(Uuid::new_v4().to_string()),
        })
        .await
        .unwrap();
    let child = repo
        .create_category(NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: Some("#DB1313".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        })
        .await
        .unwrap();

    let updated = repo
        .update_category(TransactionCategoryUpdate {
            id: child.id.clone(),
            name: "Promoted Child".to_string(),
            parent_id: None,
            description: None,
            color: Some("#AB63F2".to_string()),
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        })
        .await
        .unwrap();

    assert_eq!(updated.parent_id, None);
    assert_eq!(repo.get_category(&child.id).await.unwrap().parent_id, None);
}

#[tokio::test]
async fn update_category_clears_root_color_in_database() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let created = repo
        .create_category(NewTransactionCategory {
            name: "Original".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: Some(CategoryRole::Spending),
            id: Some(Uuid::new_v4().to_string()),
        })
        .await
        .unwrap();

    let updated = repo
        .update_category(TransactionCategoryUpdate {
            id: created.id.clone(),
            name: "Original".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        })
        .await
        .unwrap();

    assert_eq!(updated.color, None);
    assert_eq!(repo.get_category(&created.id).await.unwrap().color, None);
}

#[tokio::test]
async fn update_category_clears_description_in_database() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let created = repo
        .create_category(NewTransactionCategory {
            name: "Original".to_string(),
            parent_id: None,
            description: Some("Original description".to_string()),
            color: Some("#D31212".to_string()),
            role: Some(CategoryRole::Spending),
            id: Some(Uuid::new_v4().to_string()),
        })
        .await
        .unwrap();

    let updated = repo
        .update_category(TransactionCategoryUpdate {
            id: created.id.clone(),
            name: "Original".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        })
        .await
        .unwrap();

    assert_eq!(updated.description, None);
    assert_eq!(
        repo.get_category(&created.id).await.unwrap().description,
        None
    );
}
