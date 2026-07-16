use super::repository::TransactionCategoriesRepository;
use crate::budgets::BudgetsRepository;
use crate::connection::{get_connection, run_migrations};
use crate::schema::transactions;
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use uuid::Uuid;
use zai_core::Error;
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetMeasurementMode, BudgetRolloverMode, NewBudget,
};
use zai_core::features::budgets::traits::BudgetsRepositoryTrait;
use zai_core::features::transaction_categories::models::{
    CategoryChildrenDeleteStrategy, CategoryRole, NewTransactionCategory, TransactionCategory,
    TransactionCategoryUpdate,
};
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;
use zai_core::features::transactions::models::NewTransaction;

fn setup_test_repo(db_path: &str) -> TransactionCategoriesRepository {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(db_path);
    let pool = Pool::builder()
        .build(manager)
        .expect("Failed to create pool");

    run_migrations(&pool.clone()).unwrap();

    let writer = spawn_writer(pool.clone()).unwrap();

    TransactionCategoriesRepository::new(Arc::new(pool), writer)
}

fn insert_transaction_with_category(repo: &TransactionCategoriesRepository, category_id: &str) {
    let conn = &mut get_connection(repo.pool()).unwrap();
    let transaction = NewTransaction {
        id: Some(Uuid::new_v4().to_string()),
        description: Some("Lunch".to_string()),
        amount: 1200,
        transaction_date: chrono::Utc::now().naive_utc(),
        transaction_type: "expense".to_string(),
        transaction_category_id: Some(category_id.to_string()),
        notes: None,
    };

    diesel::insert_into(transactions::table)
        .values((
            transactions::id.eq(transaction.id.unwrap()),
            transactions::description.eq(transaction.description),
            transactions::amount.eq(transaction.amount),
            transactions::transaction_date.eq(transaction.transaction_date),
            transactions::transaction_type.eq(transaction.transaction_type),
            transactions::transaction_category_id.eq(transaction.transaction_category_id),
            transactions::notes.eq(transaction.notes),
        ))
        .execute(conn)
        .unwrap();
}

fn new_scoped_budget(category_id: &str) -> NewBudget {
    NewBudget {
        id: Some("budget-1".to_string()),
        name: "Food budget".to_string(),
        base_allowance: 10_000,
        cadence: Some(BudgetCadence::Month),
        category_ids: vec![category_id.to_string()],
        measurement_mode: Some(BudgetMeasurementMode::Spending),
        rollover_mode: Some(BudgetRolloverMode::Off),
        warning_percentage: Some(80),
    }
}

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

#[tokio::test]
async fn test_create_category_preserves_child_color() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let parent = NewTransactionCategory {
        name: "Parent".to_string(),
        parent_id: None,
        description: None,
        color: Some("#D31212".to_string()),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_parent = repo.create_category(parent).await.unwrap();

    let child = NewTransactionCategory {
        name: "Child".to_string(),
        parent_id: Some(created_parent.id.clone()),
        description: None,
        color: Some("#3C99F6".to_string()),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_child = repo.create_category(child).await.unwrap();

    assert_eq!(created_child.color.as_deref(), Some("#3C99F6"));
}

#[tokio::test]
async fn test_create_category_preserves_missing_child_color() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let parent = NewTransactionCategory {
        name: "Parent".to_string(),
        parent_id: None,
        description: None,
        color: Some("#D31212".to_string()),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_parent = repo.create_category(parent).await.unwrap();

    let child = NewTransactionCategory {
        name: "Child".to_string(),
        parent_id: Some(created_parent.id),
        description: None,
        color: None,
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_child = repo.create_category(child).await.unwrap();

    assert_eq!(created_child.color, None);
}

#[tokio::test]
async fn test_update_category_preserves_child_color() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let parent = NewTransactionCategory {
        name: "Parent".to_string(),
        parent_id: None,
        description: None,
        color: Some("#D31212".to_string()),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_parent = repo.create_category(parent).await.unwrap();

    let child = NewTransactionCategory {
        name: "Child".to_string(),
        parent_id: Some(created_parent.id.clone()),
        description: None,
        color: Some("#DB1313".to_string()),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_child = repo.create_category(child).await.unwrap();

    let updated_child = TransactionCategoryUpdate {
        id: created_child.id,
        name: "Child Updated".to_string(),
        parent_id: Some(created_parent.id),
        description: None,
        color: Some("#AB63F2".to_string()),
        role: None,
        confirm_budget_impact: false,
    };

    let updated_child = repo.update_category(updated_child).await.unwrap();

    assert_eq!(updated_child.color.as_deref(), Some("#AB63F2"));
}

#[tokio::test]
async fn test_update_category_keeps_root_color_when_parent_is_removed() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let parent = NewTransactionCategory {
        name: "Parent".to_string(),
        parent_id: None,
        description: None,
        color: Some("#D31212".to_string()),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_parent = repo.create_category(parent).await.unwrap();

    let child = NewTransactionCategory {
        name: "Child".to_string(),
        parent_id: Some(created_parent.id.clone()),
        description: None,
        color: Some("#DB1313".to_string()),
        role: None,
        id: Some(Uuid::new_v4().to_string()),
    };
    let created_child = repo.create_category(child).await.unwrap();

    let updated_child = TransactionCategoryUpdate {
        id: created_child.id,
        name: "Promoted Child".to_string(),
        parent_id: None,
        description: None,
        color: Some("#AB63F2".to_string()),
        role: None,
        confirm_budget_impact: false,
    };

    let updated_child = repo.update_category(updated_child).await.unwrap();

    assert_eq!(updated_child.color.as_deref(), Some("#AB63F2"));
}

#[tokio::test]
async fn test_sibling_name_exists_compares_trimmed_names_case_insensitively() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    repo.create_category(NewTransactionCategory {
        name: "Food".to_string(),
        parent_id: None,
        description: None,
        color: None,
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
    let conn = &mut get_connection(repo.pool()).unwrap();
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
    let budgets = BudgetsRepository::new(Arc::clone(repo.pool()), repo.writer().clone());
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
    let budgets = BudgetsRepository::new(Arc::clone(repo.pool()), repo.writer().clone());
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
    let budgets = BudgetsRepository::new(Arc::clone(repo.pool()), repo.writer().clone());
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
