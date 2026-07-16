use super::*;

#[tokio::test]
async fn test_import_categories() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let new_category_1 = NewTransactionCategory {
        id: Some(Uuid::new_v4().to_string()),
        name: "Test Category 1".to_string(),
        parent_id: None,
        description: Some("Descrizione test".to_string()),
        color: Some("#FF0000".to_string()),
        role: None,
    };

    let new_category_2 = NewTransactionCategory {
        id: Some(Uuid::new_v4().to_string()),
        name: "Test Category 2".to_string(),
        parent_id: None,
        description: Some("Descrizione test".to_string()),
        color: Some("#FF0000".to_string()),
        role: None,
    };

    let new_category_3 = NewTransactionCategory {
        id: Some(Uuid::new_v4().to_string()),
        name: "Test Category 3".to_string(),
        parent_id: Some(new_category_1.id.as_deref().unwrap().to_string()),
        description: Some("Descrizione test".to_string()),
        color: Some("#DB1313".to_string()),
        role: None,
    };

    let created: Vec<TransactionCategory> = repo
        .import_categories(vec![new_category_1, new_category_2, new_category_3])
        .await
        .unwrap();

    assert_eq!(created.len(), 3);
    assert!(
        created
            .iter()
            .any(|category| category.color.as_deref() == Some("#DB1313"))
    );
}
