use super::repository::BudgetsRepository;
use crate::connection::run_migrations;
use crate::test_utils::TempDb;
use crate::transaction_categories::TransactionCategoriesRepository;
use crate::transactions::TransactionsRepository;
use crate::write_actor::spawn_writer;
use chrono::{Datelike, Local};
use diesel::r2d2::{self, Pool};
use std::sync::Arc;
use uuid::Uuid;
use zai_core::Error;
use zai_core::features::budgets::models::{BudgetStatus, NewBudget};
use zai_core::features::budgets::traits::BudgetsRepositoryTrait;
use zai_core::features::transaction_categories::models::{CategoryRole, NewTransactionCategory};
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;
use zai_core::features::transactions::models::NewTransaction;
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;

fn setup(
    temp_db: &TempDb,
) -> (
    BudgetsRepository,
    TransactionsRepository,
    TransactionCategoriesRepository,
) {
    let manager = r2d2::ConnectionManager::<diesel::sqlite::SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.clone()).expect("writer");
    let pool = Arc::new(pool);
    (
        BudgetsRepository::new(Arc::clone(&pool), writer.clone()),
        TransactionsRepository::new(Arc::clone(&pool), writer.clone()),
        TransactionCategoriesRepository::new(pool, writer),
    )
}

fn new_budget(id: &str, name: &str, allowance: i64) -> NewBudget {
    NewBudget {
        id: Some(id.to_string()),
        name: name.to_string(),
        base_allowance: allowance,
        measurement_mode: None,
        warning_percentage: Some(80),
    }
}

#[tokio::test]
async fn create_budget_uses_existing_month_transactions_and_materializes_projection() {
    let temp_db = TempDb::new();
    let (budgets, transactions, categories) = setup(&temp_db);
    let now = Local::now().naive_local();
    let spending_category = categories
        .create_category(NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            parent_id: None,
            name: "Groceries".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
        })
        .await
        .expect("category");

    transactions
        .create_transaction(NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some("Before budget".to_string()),
            amount: 1_250,
            transaction_date: now,
            transaction_type: "expense".to_string(),
            transaction_category_id: Some(spending_category.id),
            notes: None,
        })
        .await
        .expect("transaction");

    let budget = budgets
        .create_budget(new_budget("budget-1", "Monthly spending", 10_000))
        .await
        .expect("budget");

    assert_eq!(budget.name, "Monthly spending");
    assert_eq!(budget.category_ids, Vec::<String>::new());
    assert_eq!(budget.current_period.net_budget_spending, 1_250);
    assert_eq!(budget.current_period.effective_allowance, 10_000);
    assert_eq!(budget.current_period.remaining_allowance, 8_750);
    assert_eq!(budget.current_period.status, BudgetStatus::OnTrack);
    assert_eq!(budget.current_period.start.day(), 1);
    assert_eq!(budget.current_period.end.day(), 1);
}

#[tokio::test]
async fn spending_budget_counts_refunds_but_ignores_income_category_income() {
    let temp_db = TempDb::new();
    let (budgets, transactions, categories) = setup(&temp_db);
    let spending_category = categories
        .create_category(NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            parent_id: None,
            name: "Shopping".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
        })
        .await
        .expect("spending category");
    let income_category = categories
        .create_category(NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            parent_id: None,
            name: "Salary".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Income),
        })
        .await
        .expect("income category");

    for (amount, transaction_type, category_id) in [
        (10_000, "expense", Some(spending_category.id.clone())),
        (2_000, "income", Some(spending_category.id)),
        (50_000, "income", Some(income_category.id)),
    ] {
        transactions
            .create_transaction(NewTransaction {
                id: Some(Uuid::new_v4().to_string()),
                description: None,
                amount,
                transaction_date: Local::now().naive_local(),
                transaction_type: transaction_type.to_string(),
                transaction_category_id: category_id,
                notes: None,
            })
            .await
            .expect("transaction");
    }

    let budget = budgets
        .create_budget(new_budget("budget-2", "Spending", 20_000))
        .await
        .expect("budget");

    assert_eq!(budget.current_period.net_budget_spending, 8_000);
}

#[tokio::test]
async fn active_budget_names_are_case_insensitively_unique_with_structured_error() {
    let temp_db = TempDb::new();
    let (budgets, _, _) = setup(&temp_db);
    budgets
        .create_budget(new_budget("budget-1", "Monthly", 10_000))
        .await
        .expect("first budget");

    let error = budgets
        .create_budget(new_budget("budget-2", " monthly ", 12_000))
        .await
        .expect_err("duplicate name should fail");

    assert!(matches!(error, Error::NameConflict(_)));
    assert_eq!(budgets.list_budgets().await.expect("list").len(), 1);
}

#[tokio::test]
async fn reading_budget_rebuilds_projected_result_after_transaction_changes() {
    let temp_db = TempDb::new();
    let (budgets, transactions, _) = setup(&temp_db);
    budgets
        .create_budget(new_budget("budget-3", "Rebuild", 10_000))
        .await
        .expect("budget");

    transactions
        .create_transaction(NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: None,
            amount: 2_500,
            transaction_date: Local::now().naive_local(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("transaction");

    let refreshed = budgets.get_budget("budget-3").await.expect("budget detail");
    assert_eq!(refreshed.current_period.net_budget_spending, 2_500);
    assert_eq!(refreshed.current_period.remaining_allowance, 7_500);
}
