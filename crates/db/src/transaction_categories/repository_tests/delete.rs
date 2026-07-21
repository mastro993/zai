use super::*;

#[tokio::test]
async fn test_delete_parent_category_promotes_children() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let parent = repo
        .create_category(NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        })
        .await
        .unwrap();
    let child = repo
        .create_category(NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        })
        .await
        .unwrap();

    repo.delete_categories(
        vec![&parent.id],
        CategoryChildrenDeleteStrategy::Promote,
        false,
    )
    .await
    .unwrap();
    let promoted = repo.get_category(&child.id).await.unwrap();

    assert!(promoted.parent_id.is_none());
}

#[tokio::test]
async fn test_delete_parent_category_deletes_children() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let parent = repo
        .create_category(NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        })
        .await
        .unwrap();
    let child = repo
        .create_category(NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        })
        .await
        .unwrap();

    let deleted = repo
        .delete_categories(
            vec![&parent.id],
            CategoryChildrenDeleteStrategy::Delete,
            false,
        )
        .await
        .unwrap();

    assert!(deleted.iter().any(|category| category.id == child.id));
}

#[tokio::test]
async fn test_delete_category_uncategorizes_transactions() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let category = repo
        .create_category(NewTransactionCategory {
            name: "Food".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        })
        .await
        .unwrap();
    insert_transaction_with_category(&repo, &category.id);

    repo.delete_categories(
        vec![&category.id],
        CategoryChildrenDeleteStrategy::Block,
        false,
    )
    .await
    .unwrap();
    let conn = &mut get_connection(&repo.pool).unwrap();
    let category_id = transactions::table
        .select(transactions::transaction_category_id)
        .first::<Option<String>>(conn)
        .unwrap();

    assert!(category_id.is_none());
}

#[tokio::test]
async fn role_changes_require_confirmation_when_budget_scope_is_affected() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let budgets = BudgetsRepository::new(Arc::clone(&repo.pool), repo.writer.clone());
    let category = repo
        .create_category(NewTransactionCategory {
            name: "Food".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
            id: Some("food".to_string()),
        })
        .await
        .expect("category");
    budgets
        .create_budget(new_scoped_budget(&category.id))
        .await
        .expect("budget");

    let update = |confirm_budget_impact| TransactionCategoryUpdate {
        id: category.id.clone(),
        parent_id: None,
        name: "Food".to_string(),
        description: None,
        color: None,
        role: Some(CategoryRole::Income),
        confirm_budget_impact,
    };

    let error = repo
        .update_category(update(false))
        .await
        .expect_err("role change should require confirmation");
    assert!(matches!(
        error,
        Error::BudgetImpactConfirmationRequired { .. }
    ));
    assert_eq!(
        repo.get_category(&category.id).await.unwrap().role,
        CategoryRole::Spending
    );

    repo.update_category(update(true))
        .await
        .expect("confirmed role change");
    assert_eq!(
        repo.get_category(&category.id).await.unwrap().role,
        CategoryRole::Income
    );
}

#[tokio::test]
async fn direct_current_budget_selection_blocks_category_deletion() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let budgets = BudgetsRepository::new(Arc::clone(&repo.pool), repo.writer.clone());
    let category = repo
        .create_category(NewTransactionCategory {
            name: "Food".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
            id: Some("food".to_string()),
        })
        .await
        .expect("category");
    budgets
        .create_budget(new_scoped_budget(&category.id))
        .await
        .expect("budget");

    let error = repo
        .delete_categories(
            vec![&category.id],
            CategoryChildrenDeleteStrategy::Block,
            true,
        )
        .await
        .expect_err("direct selection should block deletion");
    assert!(matches!(error, Error::CategoryDeletionBlocked { .. }));
    assert!(repo.get_category(&category.id).await.is_ok());
}

#[tokio::test]
async fn indirectly_covered_deletion_requires_confirmation_then_rebuilds_budget() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let budgets = BudgetsRepository::new(Arc::clone(&repo.pool), repo.writer.clone());
    let root = repo
        .create_category(NewTransactionCategory {
            name: "Food".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
            id: Some("food".to_string()),
        })
        .await
        .expect("root");
    let child = repo
        .create_category(NewTransactionCategory {
            name: "Groceries".to_string(),
            parent_id: Some(root.id.clone()),
            description: None,
            color: None,
            role: None,
            id: Some("groceries".to_string()),
        })
        .await
        .expect("child");
    let mut budget = new_scoped_budget(&root.id);
    budget.id = Some("budget-2".to_string());
    budgets.create_budget(budget).await.expect("budget");

    let error = repo
        .delete_categories(
            vec![&child.id],
            CategoryChildrenDeleteStrategy::Block,
            false,
        )
        .await
        .expect_err("indirect coverage should require confirmation");
    assert!(matches!(
        error,
        Error::BudgetImpactConfirmationRequired { .. }
    ));

    repo.delete_categories(vec![&child.id], CategoryChildrenDeleteStrategy::Block, true)
        .await
        .expect("confirmed deletion");
    assert!(repo.get_category(&child.id).await.is_err());
    assert!(repo.get_category(&root.id).await.is_ok());
}

#[tokio::test]
async fn block_delete_rechecks_children_inside_writer() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let parent = repo
        .create_category(NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        })
        .await
        .expect("parent");
    repo.create_category(NewTransactionCategory {
        name: "Child".to_string(),
        parent_id: Some(parent.id.clone()),
        description: None,
        color: None,
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    })
    .await
    .expect("child");

    let error = repo
        .delete_categories(
            vec![&parent.id],
            CategoryChildrenDeleteStrategy::Block,
            false,
        )
        .await
        .expect_err("block strategy must reject live children");
    assert!(matches!(error, Error::Conflict(_)));
    assert!(repo.get_category(&parent.id).await.is_ok());
}
