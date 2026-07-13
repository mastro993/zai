use super::BudgetsRepository;
use super::new_budget;
use crate::connection::run_migrations;
use crate::test_utils::TempDb;
use crate::transaction_categories::TransactionCategoriesRepository;
use crate::transactions::TransactionsRepository;
use crate::write_actor::spawn_writer;
use chrono::{Datelike, NaiveDate, NaiveDateTime};
use diesel::r2d2::{self, Pool};
use diesel::{Connection, RunQueryDsl, SqliteConnection, sql_query};
use std::sync::Arc;
use zai_core::Error;
use zai_core::features::budgets::models::{BudgetRolloverMode, BudgetUpdate};
use zai_core::features::budgets::traits::{BudgetsRepositoryTrait, CalendarClock};
use zai_core::features::transaction_categories::models::{
    CategoryRole, NewTransactionCategory, TransactionCategoryUpdate,
};
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;
use zai_core::features::transactions::models::NewTransaction;
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;

struct ManualClock {
    now: std::sync::Mutex<NaiveDateTime>,
}

impl CalendarClock for ManualClock {
    fn sample(&self) -> NaiveDateTime {
        *self.now.lock().expect("clock lock")
    }
}

fn setup_with_clock(
    temp_db: &TempDb,
    clock: Arc<dyn CalendarClock>,
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
        BudgetsRepository::new_with_clock(Arc::clone(&pool), writer.clone(), Arc::clone(&clock)),
        TransactionsRepository::new_with_clock(
            Arc::clone(&pool),
            writer.clone(),
            Arc::clone(&clock),
        ),
        TransactionCategoriesRepository::new_with_clock(
            Arc::clone(&pool),
            writer.clone(),
            Arc::clone(&clock),
        ),
    )
}

#[tokio::test]
async fn history_advances_empty_periods_and_applies_rollover_modes() {
    let temp_db = TempDb::new();
    let january = NaiveDate::from_ymd_opt(2026, 1, 15)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap();
    let clock = Arc::new(ManualClock {
        now: std::sync::Mutex::new(january),
    });
    let (budgets, transactions, _) = setup_with_clock(&temp_db, clock.clone());

    let mut budget = new_budget("rollover", "Rollover", 100);
    budget.rollover_mode = Some(BudgetRolloverMode::PreviousPeriodOnly);
    budgets.create_budget(budget).await.expect("budget");
    transactions
        .create_transaction(NewTransaction {
            id: Some("january-spending".to_string()),
            description: None,
            amount: 30,
            transaction_date: january,
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("transaction");

    *clock.now.lock().expect("clock lock") = NaiveDate::from_ymd_opt(2026, 3, 15)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap();
    let history = budgets
        .get_budget_history("rollover", 1, 10)
        .await
        .expect("history");

    assert_eq!(history.total_pages, 1);
    assert_eq!(history.data.len(), 3);
    assert_eq!(history.data[0].start.month(), 3);
    assert_eq!(history.data[1].effective_allowance, 170);
    assert_eq!(history.data[2].effective_allowance, 100);
    assert_eq!(history.data[2].remaining_allowance, 70);

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    sql_query(
        "DELETE FROM budget_period_results WHERE budget_id = 'rollover' AND period_start LIKE '2026-01%'",
    )
    .execute(&mut conn)
    .expect("delete closed result");

    let repaired_history = budgets
        .get_budget_history("rollover", 1, 10)
        .await
        .expect("repaired history");
    assert_eq!(repaired_history.data.len(), 3);
}

#[tokio::test]
async fn history_rejects_page_sizes_outside_one_to_one_hundred() {
    let temp_db = TempDb::new();
    let (budgets, _, _) = super::setup(&temp_db);

    let error = budgets
        .get_budget_history("missing", 1, 101)
        .await
        .expect_err("invalid page size");

    assert!(matches!(error, Error::InvalidData(_)));
}

#[tokio::test]
async fn updating_current_period_leaves_closed_configurations_immutable() {
    let temp_db = TempDb::new();
    let january = NaiveDate::from_ymd_opt(2026, 1, 15)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap();
    let clock = Arc::new(ManualClock {
        now: std::sync::Mutex::new(january),
    });
    let (budgets, _, _) = setup_with_clock(&temp_db, clock.clone());
    let created = budgets
        .create_budget(new_budget("immutable", "Immutable", 100))
        .await
        .expect("budget");

    *clock.now.lock().expect("clock lock") = NaiveDate::from_ymd_opt(2026, 3, 15)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap();
    budgets.get_budget("immutable").await.expect("catch up");

    let updated = budgets
        .update_budget(
            "immutable",
            BudgetUpdate {
                expected_revision: created.revision,
                name: "Immutable".to_string(),
                base_allowance: 200,
                cadence: created.cadence,
                category_ids: created.category_ids,
                measurement_mode: created.measurement_mode,
                rollover_mode: created.rollover_mode,
                warning_percentage: created.warning_percentage,
            },
        )
        .await
        .expect("current update");
    let history = budgets
        .get_budget_history("immutable", 1, 50)
        .await
        .expect("history");

    assert_eq!(updated.current_period.base_allowance, 200);
    assert_eq!(history.data.len(), 3);
    assert_eq!(history.data[0].base_allowance, 200);
    assert_eq!(history.data[1].base_allowance, 100);
    assert_eq!(history.data[2].base_allowance, 100);
}

#[tokio::test]
async fn confirmed_category_role_change_rebuilds_historical_rollover_suffix() {
    let temp_db = TempDb::new();
    let january = NaiveDate::from_ymd_opt(2026, 1, 15)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap();
    let clock = Arc::new(ManualClock {
        now: std::sync::Mutex::new(january),
    });
    let (budgets, transactions, categories) = setup_with_clock(&temp_db, clock.clone());
    let category = categories
        .create_category(NewTransactionCategory {
            id: Some("food".to_string()),
            parent_id: None,
            name: "Food".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
        })
        .await
        .expect("category");

    for (id, amount, transaction_type) in [("expense", 30, "expense"), ("refund", 10, "income")] {
        transactions
            .create_transaction(NewTransaction {
                id: Some(id.to_string()),
                description: None,
                amount,
                transaction_date: january,
                transaction_type: transaction_type.to_string(),
                transaction_category_id: Some(category.id.clone()),
                notes: None,
            })
            .await
            .expect("transaction");
    }

    let mut budget = new_budget("role-repair", "Role repair", 100);
    budget.category_ids = vec![category.id.clone()];
    budget.rollover_mode = Some(BudgetRolloverMode::Cumulative);
    budgets.create_budget(budget).await.expect("budget");

    *clock.now.lock().expect("clock lock") = NaiveDate::from_ymd_opt(2026, 3, 15)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap();
    budgets
        .get_budget_history("role-repair", 1, 10)
        .await
        .expect("materialize history");

    let update = |confirm_budget_impact| TransactionCategoryUpdate {
        id: category.id.clone(),
        parent_id: None,
        name: "Food".to_string(),
        description: None,
        color: None,
        role: Some(CategoryRole::Income),
        confirm_budget_impact,
    };
    let error = categories
        .update_category(update(false))
        .await
        .expect_err("role change should require confirmation");
    assert!(matches!(
        error,
        Error::BudgetImpactConfirmationRequired { .. }
    ));

    categories
        .update_category(update(true))
        .await
        .expect("confirmed role change");
    let history = budgets
        .get_budget_history("role-repair", 1, 10)
        .await
        .expect("repaired history");

    assert_eq!(history.data[2].net_budget_spending, 30);
    assert_eq!(history.data[2].remaining_allowance, 70);
    assert_eq!(history.data[1].effective_allowance, 170);
    assert_eq!(history.data[0].effective_allowance, 270);
}
