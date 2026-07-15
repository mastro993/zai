use super::TransactionCategoriesRepository;
use crate::connection::run_migrations;
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use diesel::r2d2::{self, Pool};
use std::sync::Arc;
use tokio::sync::Barrier;
use uuid::Uuid;
use zai_core::Error;
use zai_core::features::transaction_categories::models::{
    CategoryRole, NewTransactionCategory, TransactionCategoryUpdate,
};
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;

fn setup_repo(temp_db: &TempDb) -> TransactionCategoriesRepository {
    let manager = r2d2::ConnectionManager::<diesel::sqlite::SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.clone()).expect("writer");
    TransactionCategoriesRepository::new(Arc::new(pool), writer)
}

async fn create_root(repo: &TransactionCategoriesRepository, name: &str) -> String {
    let category = repo
        .create_category(NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            name: name.to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
        })
        .await
        .expect("create root");
    category.id
}

fn child_update(id: &str, parent_id: &str, name: &str) -> TransactionCategoryUpdate {
    TransactionCategoryUpdate {
        id: id.to_string(),
        parent_id: Some(parent_id.to_string()),
        name: name.to_string(),
        description: None,
        color: None,
        role: Some(CategoryRole::Spending),
        confirm_budget_impact: false,
    }
}

#[tokio::test]
async fn concurrent_root_updates_cannot_create_cycle() {
    let temp_db = TempDb::new();
    let repo = Arc::new(setup_repo(&temp_db));
    let left_id = create_root(&repo, "Alpha").await;
    let right_id = create_root(&repo, "Beta").await;

    let barrier = Arc::new(Barrier::new(2));
    let left = {
        let repo = Arc::clone(&repo);
        let barrier = Arc::clone(&barrier);
        let update = child_update(&left_id, &right_id, "Alpha");
        tokio::spawn(async move {
            barrier.wait().await;
            repo.update_category(update).await
        })
    };
    let right = {
        let repo = Arc::clone(&repo);
        let barrier = Arc::clone(&barrier);
        let update = child_update(&right_id, &left_id, "Beta");
        tokio::spawn(async move {
            barrier.wait().await;
            repo.update_category(update).await
        })
    };

    let (left, right) = tokio::try_join!(left, right).expect("join");
    let outcomes = [left, right];
    let successes = outcomes.iter().filter(|result| result.is_ok()).count();
    let conflicts = outcomes
        .iter()
        .filter(|result| matches!(result, Err(Error::Conflict(_))))
        .count();

    assert_eq!(successes, 1);
    assert_eq!(conflicts, 1);

    let alpha = repo.get_category(&left_id).expect("alpha");
    let beta = repo.get_category(&right_id).expect("beta");
    let parent_child_pairs = [
        alpha.parent_id.as_deref() == Some(right_id.as_str()),
        beta.parent_id.as_deref() == Some(left_id.as_str()),
    ];
    assert_eq!(
        parent_child_pairs
            .iter()
            .filter(|&&matched| matched)
            .count(),
        1
    );
}

#[tokio::test]
async fn concurrent_updates_cannot_create_depth_three() {
    let temp_db = TempDb::new();
    let repo = Arc::new(setup_repo(&temp_db));
    let parent_id = create_root(&repo, "Parent").await;
    let other_root_id = create_root(&repo, "Other").await;
    let child_id = repo
        .create_category(NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            name: "Child".to_string(),
            parent_id: Some(parent_id.clone()),
            description: None,
            color: None,
            role: None,
        })
        .await
        .expect("child")
        .id;

    let barrier = Arc::new(Barrier::new(2));
    let parent_update = {
        let repo = Arc::clone(&repo);
        let barrier = Arc::clone(&barrier);
        let update = child_update(&parent_id, &other_root_id, "Parent");
        tokio::spawn(async move {
            barrier.wait().await;
            repo.update_category(update).await
        })
    };
    let child_update_task = {
        let repo = Arc::clone(&repo);
        let barrier = Arc::clone(&barrier);
        let update = TransactionCategoryUpdate {
            id: child_id.clone(),
            parent_id: Some(parent_id.clone()),
            name: "Child renamed".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        };
        tokio::spawn(async move {
            barrier.wait().await;
            repo.update_category(update).await
        })
    };

    let (parent_result, child_result) =
        tokio::try_join!(parent_update, child_update_task).expect("join");
    assert!(parent_result.is_err());
    assert!(matches!(parent_result, Err(Error::Conflict(_))));
    assert!(child_result.is_ok());

    let parent = repo.get_category(&parent_id).expect("parent");
    let child = repo.get_category(&child_id).expect("child");
    assert!(parent.parent_id.is_none());
    assert_eq!(child.parent_id.as_deref(), Some(parent_id.as_str()));
    assert_eq!(child.name, "Child renamed");
}

#[tokio::test]
async fn concurrent_sibling_name_updates_leave_one_conflict() {
    let temp_db = TempDb::new();
    let repo = Arc::new(setup_repo(&temp_db));
    let first_id = create_root(&repo, "Food").await;
    let second_id = create_root(&repo, "Travel").await;

    let barrier = Arc::new(Barrier::new(2));
    let first = {
        let repo = Arc::clone(&repo);
        let barrier = Arc::clone(&barrier);
        let update = TransactionCategoryUpdate {
            id: first_id.clone(),
            parent_id: None,
            name: "Shared".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        };
        tokio::spawn(async move {
            barrier.wait().await;
            repo.update_category(update).await
        })
    };
    let second = {
        let repo = Arc::clone(&repo);
        let barrier = Arc::clone(&barrier);
        let update = TransactionCategoryUpdate {
            id: second_id.clone(),
            parent_id: None,
            name: " shared ".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        };
        tokio::spawn(async move {
            barrier.wait().await;
            repo.update_category(update).await
        })
    };

    let (first, second) = tokio::try_join!(first, second).expect("join");
    let outcomes = [first, second];
    let successes = outcomes.iter().filter(|result| result.is_ok()).count();
    let conflicts = outcomes
        .iter()
        .filter(|result| matches!(result, Err(Error::Conflict(_))))
        .count();

    assert_eq!(successes, 1);
    assert_eq!(conflicts, 1);
}

#[tokio::test]
async fn unrelated_concurrent_updates_both_succeed() {
    let temp_db = TempDb::new();
    let repo = Arc::new(setup_repo(&temp_db));
    let first_id = create_root(&repo, "Food").await;
    let second_id = create_root(&repo, "Travel").await;

    let barrier = Arc::new(Barrier::new(2));
    let first = {
        let repo = Arc::clone(&repo);
        let barrier = Arc::clone(&barrier);
        let update = TransactionCategoryUpdate {
            id: first_id.clone(),
            parent_id: None,
            name: "Groceries".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        };
        tokio::spawn(async move {
            barrier.wait().await;
            repo.update_category(update).await
        })
    };
    let second = {
        let repo = Arc::clone(&repo);
        let barrier = Arc::clone(&barrier);
        let update = TransactionCategoryUpdate {
            id: second_id.clone(),
            parent_id: None,
            name: "Flights".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        };
        tokio::spawn(async move {
            barrier.wait().await;
            repo.update_category(update).await
        })
    };

    let (first, second) = tokio::try_join!(first, second).expect("join");
    assert!(first.is_ok());
    assert!(second.is_ok());
    assert_eq!(repo.get_category(&first_id).unwrap().name, "Groceries");
    assert_eq!(repo.get_category(&second_id).unwrap().name, "Flights");
}
