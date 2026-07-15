use super::{new_budget, setup};
use crate::connection::run_migrations;
use crate::test_utils::TempDb;
use crate::transaction_categories::TransactionCategoriesRepository;
use crate::transactions::TransactionsRepository;
use crate::write_actor::spawn_writer;
use chrono::{NaiveDate, NaiveDateTime};
use diesel::r2d2::{self, Pool};
use diesel::sql_types::{BigInt, Text};
use diesel::{Connection, RunQueryDsl, SqliteConnection, sql_query};
use std::sync::{Arc, Mutex};
use zai_core::Error;
use zai_core::features::budgets::models::{BudgetRolloverMode, NewBudget};
use zai_core::features::budgets::traits::{BudgetsRepositoryTrait, CalendarClock};
use zai_core::features::transaction_categories::models::{CategoryRole, NewTransactionCategory};
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;
use zai_core::features::transactions::models::{NewTransaction, TransactionUpdate};
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;

struct ManualClock {
    now: Mutex<NaiveDateTime>,
}

#[derive(diesel::QueryableByName)]
struct ProjectionSpending {
    #[diesel(sql_type = BigInt)]
    net_budget_spending: i64,
}

impl CalendarClock for ManualClock {
    fn sample(&self) -> NaiveDateTime {
        *self.now.lock().expect("clock lock")
    }
}

fn date(year: i32, month: u32, day: u32) -> NaiveDateTime {
    NaiveDate::from_ymd_opt(year, month, day)
        .expect("date")
        .and_hms_opt(12, 0, 0)
        .expect("time")
}

fn setup_with_clock(
    temp_db: &TempDb,
    clock: Arc<dyn CalendarClock>,
) -> (
    super::BudgetsRepository,
    TransactionsRepository,
    TransactionCategoriesRepository,
) {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.clone()).expect("writer");
    let pool = Arc::new(pool);
    (
        super::BudgetsRepository::new_with_clock(
            Arc::clone(&pool),
            writer.clone(),
            Arc::clone(&clock),
        ),
        TransactionsRepository::new_with_clock(
            Arc::clone(&pool),
            writer.clone(),
            Arc::clone(&clock),
        ),
        TransactionCategoriesRepository::new_with_clock(pool, writer, clock),
    )
}

#[tokio::test]
async fn updating_transaction_repairs_historical_period_and_rollover_suffix() {
    let temp_db = TempDb::new();
    let january = date(2026, 1, 15);
    let february = date(2026, 2, 15);
    let march = date(2026, 3, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(january),
    });
    let (budgets, transactions, _) = setup_with_clock(&temp_db, clock.clone());

    let mut budget = new_budget("repair-rollover", "Repair rollover", 100);
    budget.rollover_mode = Some(BudgetRolloverMode::Cumulative);
    budgets.create_budget(budget).await.expect("budget");
    transactions
        .create_transaction(NewTransaction {
            id: Some("move-me".to_string()),
            description: None,
            amount: 50,
            transaction_date: january,
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("transaction");

    *clock.now.lock().expect("clock lock") = march;
    budgets
        .get_budget_history("repair-rollover", 1, 50)
        .await
        .expect("materialize history");

    transactions
        .update_transaction(TransactionUpdate {
            id: "move-me".to_string(),
            description: None,
            amount: 50,
            transaction_date: february,
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("move transaction");

    let history = budgets
        .get_budget_history("repair-rollover", 1, 50)
        .await
        .expect("repaired history");
    assert_eq!(history.data.len(), 3);
    assert_eq!(history.data[2].net_budget_spending, 0);
    assert_eq!(history.data[2].remaining_allowance, 100);
    assert_eq!(history.data[1].net_budget_spending, 50);
    assert_eq!(history.data[1].effective_allowance, 200);
    assert_eq!(history.data[1].remaining_allowance, 150);
    assert_eq!(history.data[0].effective_allowance, 250);
    assert_eq!(history.data[0].remaining_allowance, 250);

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    sql_query("DELETE FROM budget_period_results WHERE budget_id = 'repair-rollover'")
        .execute(&mut conn)
        .expect("clear projection");
    let rebuilt = budgets
        .get_budget_history("repair-rollover", 1, 50)
        .await
        .expect("rebuild history");
    assert_eq!(rebuilt.data.len(), history.data.len());
    for (before, after) in history.data.iter().zip(&rebuilt.data) {
        assert_eq!(before.start, after.start);
        assert_eq!(before.end, after.end);
        assert_eq!(before.base_allowance, after.base_allowance);
        assert_eq!(before.effective_allowance, after.effective_allowance);
        assert_eq!(before.net_budget_spending, after.net_budget_spending);
        assert_eq!(before.remaining_allowance, after.remaining_allowance);
        assert_eq!(before.status, after.status);
    }
}

#[tokio::test]
async fn transaction_mutation_advances_stale_affected_budget_projection() {
    let temp_db = TempDb::new();
    let january = date(2026, 1, 15);
    let march = date(2026, 3, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(january),
    });
    let (budgets, transactions, _) = setup_with_clock(&temp_db, clock.clone());
    budgets
        .create_budget(new_budget("stale-repair", "Stale repair", 1_000))
        .await
        .expect("budget");

    *clock.now.lock().expect("clock lock") = march;
    transactions
        .create_transaction(NewTransaction {
            id: Some("stale-transaction".to_string()),
            description: None,
            amount: 250,
            transaction_date: march,
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("transaction");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    let projection = sql_query(
        "SELECT net_budget_spending FROM budget_period_results
         WHERE budget_id = ? AND period_start LIKE '2026-03%'",
    )
    .bind::<Text, _>("stale-repair")
    .get_result::<ProjectionSpending>(&mut conn)
    .expect("current projection");
    assert_eq!(projection.net_budget_spending, 250);
}

#[tokio::test]
async fn transaction_update_repairs_category_type_and_amount_changes() {
    let temp_db = TempDb::new();
    let now = date(2026, 7, 15);
    let (budgets, transactions, categories) = setup(&temp_db);
    let category = categories
        .create_category(NewTransactionCategory {
            id: Some("repair-category".to_string()),
            parent_id: None,
            name: "Repair category".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
        })
        .await
        .expect("category");
    let budget = budgets
        .create_budget(NewBudget {
            id: Some("repair-fields".to_string()),
            name: "Repair fields".to_string(),
            base_allowance: 1_000,
            cadence: None,
            category_ids: vec![category.id.clone()],
            measurement_mode: None,
            rollover_mode: None,
            warning_percentage: Some(80),
        })
        .await
        .expect("budget");

    transactions
        .create_transaction(NewTransaction {
            id: Some("field-change".to_string()),
            description: None,
            amount: 200,
            transaction_date: now,
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("uncategorized transaction");
    assert_eq!(
        budgets
            .get_budget(&budget.id)
            .await
            .expect("budget")
            .current_period
            .net_budget_spending,
        0
    );

    transactions
        .update_transaction(TransactionUpdate {
            id: "field-change".to_string(),
            description: None,
            amount: 300,
            transaction_date: now,
            transaction_type: "expense".to_string(),
            transaction_category_id: Some(category.id.clone()),
            notes: None,
        })
        .await
        .expect("category change");
    assert_eq!(
        budgets
            .get_budget(&budget.id)
            .await
            .expect("budget")
            .current_period
            .net_budget_spending,
        300
    );

    transactions
        .update_transaction(TransactionUpdate {
            id: "field-change".to_string(),
            description: None,
            amount: 400,
            transaction_date: now,
            transaction_type: "income".to_string(),
            transaction_category_id: Some(category.id),
            notes: None,
        })
        .await
        .expect("type and amount change");
    assert_eq!(
        budgets
            .get_budget(&budget.id)
            .await
            .expect("budget")
            .current_period
            .net_budget_spending,
        -400
    );
}

#[tokio::test]
async fn delete_bulk_delete_and_combined_import_repair_results() {
    let temp_db = TempDb::new();
    let (budgets, transactions, _) = setup(&temp_db);
    budgets
        .create_budget(new_budget("repair-mutations", "Repair mutations", 10_000))
        .await
        .expect("budget");
    let now = chrono::Local::now().naive_local();

    for (id, amount) in [("delete-one", 100), ("delete-two", 200)] {
        transactions
            .create_transaction(NewTransaction {
                id: Some(id.to_string()),
                description: None,
                amount,
                transaction_date: now,
                transaction_type: "expense".to_string(),
                transaction_category_id: None,
                notes: None,
            })
            .await
            .expect("transaction");
    }
    transactions
        .delete_transaction("delete-one")
        .await
        .expect("delete");
    transactions
        .delete_transactions(vec!["delete-two"])
        .await
        .expect("bulk delete");

    transactions
        .import_transactions_with_categories(
            vec![NewTransactionCategory {
                id: Some("imported-category".to_string()),
                parent_id: None,
                name: "Imported".to_string(),
                description: None,
                color: None,
                role: Some(CategoryRole::Spending),
            }],
            vec![NewTransaction {
                id: Some("imported-transaction".to_string()),
                description: None,
                amount: 500,
                transaction_date: now,
                transaction_type: "expense".to_string(),
                transaction_category_id: Some("imported-category".to_string()),
                notes: None,
            }],
        )
        .await
        .expect("combined import");

    let budget = budgets
        .get_budget("repair-mutations")
        .await
        .expect("budget");
    assert_eq!(budget.current_period.net_budget_spending, 500);
}

#[tokio::test]
async fn failed_projection_repair_rolls_back_transaction_insert() {
    let temp_db = TempDb::new();
    let (budgets, transactions, _) = setup(&temp_db);
    budgets
        .create_budget(new_budget("repair-rollback", "Repair rollback", 10_000))
        .await
        .expect("budget");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    sql_query(
        "UPDATE budget_configurations SET category_ids = '[' WHERE budget_id = 'repair-rollback'",
    )
    .execute(&mut conn)
    .expect("corrupt configuration");

    let error = transactions
        .create_transaction(NewTransaction {
            id: Some("rolled-back".to_string()),
            description: None,
            amount: 100,
            transaction_date: chrono::Local::now().naive_local(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect_err("repair should fail");
    assert!(matches!(error, Error::Repository(_)));

    let transactions = transactions
        .get_transactions(1, 50, None, None)
        .await
        .expect("transactions");
    assert!(transactions.data.is_empty());
}
