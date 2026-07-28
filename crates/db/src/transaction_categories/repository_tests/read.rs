use super::*;

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
    repo.delete_categories(
        vec![&created.id],
        CategoryChildrenDeleteStrategy::Block,
        false,
    )
    .await
    .unwrap();

    let all = repo.get_categories(None).await.unwrap();
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

    let category = repo.get_category(&child.id).await.unwrap();
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
    repo.delete_categories(
        vec![&created.id],
        CategoryChildrenDeleteStrategy::Block,
        false,
    )
    .await
    .unwrap();

    let all = repo.get_categories(Some(&parent.id)).await.unwrap();
    assert!(all.len() == 1);
    assert!(all[0].name == "Cat 1");
}
