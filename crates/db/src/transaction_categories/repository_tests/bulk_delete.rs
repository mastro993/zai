use super::*;

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
            false,
        )
        .await
        .unwrap();

    assert_eq!(deleted.len(), 2);
}
