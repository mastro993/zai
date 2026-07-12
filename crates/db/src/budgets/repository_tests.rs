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
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetMeasurementMode, BudgetStatus, NewBudget,
};
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
        cadence: Some(BudgetCadence::Month),
        category_ids: Vec::new(),
        measurement_mode: None,
        rollover_mode: None,
        warning_percentage: Some(80),
    }
}

fn configured_budget(
    id: &str,
    name: &str,
    allowance: i64,
    cadence: BudgetCadence,
    category_ids: Vec<String>,
    measurement_mode: BudgetMeasurementMode,
) -> NewBudget {
    NewBudget {
        id: Some(id.to_string()),
        name: name.to_string(),
        base_allowance: allowance,
        cadence: Some(cadence),
        category_ids,
        measurement_mode: Some(measurement_mode),
        rollover_mode: None,
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

#[tokio::test]
async fn category_scope_includes_children_and_canonicalizes_redundant_selection() {
    let temp_db = TempDb::new();
    let (budgets, transactions, categories) = setup(&temp_db);
    let root = categories
        .create_category(NewTransactionCategory {
            id: Some("root".to_string()),
            parent_id: None,
            name: "Groceries".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
        })
        .await
        .expect("root category");
    let child = categories
        .create_category(NewTransactionCategory {
            id: Some("child".to_string()),
            parent_id: Some(root.id.clone()),
            name: "Produce".to_string(),
            description: None,
            color: None,
            role: None,
        })
        .await
        .expect("child category");
    let other = categories
        .create_category(NewTransactionCategory {
            id: Some("other".to_string()),
            parent_id: None,
            name: "Travel".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
        })
        .await
        .expect("other category");
    let now = Local::now().naive_local();

    for (id, amount, category_id) in [
        ("root-expense", 1_000, root.id.clone()),
        ("child-expense", 2_000, child.id.clone()),
        ("other-expense", 4_000, other.id),
    ] {
        transactions
            .create_transaction(NewTransaction {
                id: Some(id.to_string()),
                description: None,
                amount,
                transaction_date: now,
                transaction_type: "expense".to_string(),
                transaction_category_id: Some(category_id),
                notes: None,
            })
            .await
            .expect("transaction");
    }

    let budget = budgets
        .create_budget(configured_budget(
            "scoped-budget",
            "Groceries",
            10_000,
            BudgetCadence::Month,
            vec![child.id, root.id],
            BudgetMeasurementMode::Spending,
        ))
        .await
        .expect("budget");

    assert_eq!(budget.category_ids, vec!["root"]);
    assert_eq!(budget.current_period.net_budget_spending, 3_000);
}

#[tokio::test]
async fn measurement_mode_applies_signed_income_rules_to_empty_scope() {
    let temp_db = TempDb::new();
    let (budgets, transactions, categories) = setup(&temp_db);
    let spending_category = categories
        .create_category(NewTransactionCategory {
            id: Some("spending".to_string()),
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
            id: Some("income".to_string()),
            parent_id: None,
            name: "Salary".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Income),
        })
        .await
        .expect("income category");

    for (id, amount, transaction_type, category_id) in [
        (
            "expense-spending",
            100,
            "expense",
            Some(spending_category.id.clone()),
        ),
        ("expense-income", 50, "expense", Some(income_category.id)),
        ("refund", 300, "income", Some(spending_category.id)),
        ("salary", 1_000, "income", Some("income".to_string())),
        ("uncategorized-income", 200, "income", None),
    ] {
        transactions
            .create_transaction(NewTransaction {
                id: Some(id.to_string()),
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

    let spending_budget = budgets
        .create_budget(new_budget("spending-rules", "Spending rules", 10_000))
        .await
        .expect("spending budget");
    let net_budget = budgets
        .create_budget(configured_budget(
            "net-rules",
            "Net rules",
            10_000,
            BudgetCadence::Month,
            Vec::new(),
            BudgetMeasurementMode::NetCashFlow,
        ))
        .await
        .expect("net budget");

    assert_eq!(spending_budget.current_period.net_budget_spending, -150);
    assert_eq!(net_budget.current_period.net_budget_spending, -1_350);
}

#[path = "repository_cadence_tests.rs"]
mod repository_cadence_tests;

#[path = "repository_recovery_tests.rs"]
mod repository_recovery_tests;

#[path = "repository_history_tests.rs"]
mod repository_history_tests;
