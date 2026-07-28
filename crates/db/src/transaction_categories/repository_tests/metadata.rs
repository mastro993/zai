use super::*;

#[tokio::test]
async fn test_create_category_clears_child_hue() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let parent = NewTransactionCategory {
        name: "Parent".to_string(),
        parent_id: None,
        description: None,
        hue: Some(20),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_parent = repo.create_category(parent).await.unwrap();

    let child = NewTransactionCategory {
        name: "Child".to_string(),
        parent_id: Some(created_parent.id.clone()),
        description: None,
        hue: Some(220),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_child = repo.create_category(child).await.unwrap();

    assert_eq!(created_child.hue, None);
}

#[tokio::test]
async fn test_create_category_preserves_missing_child_hue() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let parent = NewTransactionCategory {
        name: "Parent".to_string(),
        parent_id: None,
        description: None,
        hue: Some(20),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_parent = repo.create_category(parent).await.unwrap();

    let child = NewTransactionCategory {
        name: "Child".to_string(),
        parent_id: Some(created_parent.id),
        description: None,
        hue: None,
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_child = repo.create_category(child).await.unwrap();

    assert_eq!(created_child.hue, None);
}

#[tokio::test]
async fn test_update_category_clears_child_hue() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let parent = NewTransactionCategory {
        name: "Parent".to_string(),
        parent_id: None,
        description: None,
        hue: Some(20),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_parent = repo.create_category(parent).await.unwrap();

    let child = NewTransactionCategory {
        name: "Child".to_string(),
        parent_id: Some(created_parent.id.clone()),
        description: None,
        hue: Some(20),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_child = repo.create_category(child).await.unwrap();

    let updated_child = TransactionCategoryUpdate {
        id: created_child.id,
        name: "Child Updated".to_string(),
        parent_id: Some(created_parent.id),
        description: None,
        hue: Some(300),
        role: None,
        confirm_budget_impact: false,
    };

    let updated_child = repo.update_category(updated_child).await.unwrap();

    assert_eq!(updated_child.hue, None);
}

#[tokio::test]
async fn test_update_category_keeps_root_hue_when_parent_is_removed() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let parent = NewTransactionCategory {
        name: "Parent".to_string(),
        parent_id: None,
        description: None,
        hue: Some(20),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_parent = repo.create_category(parent).await.unwrap();

    let child = NewTransactionCategory {
        name: "Child".to_string(),
        parent_id: Some(created_parent.id.clone()),
        description: None,
        hue: Some(20),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_child = repo.create_category(child).await.unwrap();

    let updated_child = TransactionCategoryUpdate {
        id: created_child.id,
        name: "Promoted Child".to_string(),
        parent_id: None,
        description: None,
        hue: Some(300),
        role: None,
        confirm_budget_impact: false,
    };

    let updated_child = repo.update_category(updated_child).await.unwrap();

    assert_eq!(updated_child.hue, Some(300));
}

#[tokio::test]
async fn test_sibling_name_exists_compares_trimmed_names_case_insensitively() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    repo.create_category(NewTransactionCategory {
        name: "Food".to_string(),
        parent_id: None,
        description: None,
        hue: None,
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    })
    .await
    .unwrap();

    let exists = repo
        .sibling_name_exists(None, " food ", None)
        .await
        .expect("check sibling name");

    assert!(exists);
}
