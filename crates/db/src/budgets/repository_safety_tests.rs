use super::{configured_budget, new_budget};
use crate::connection::run_migrations;
use crate::test_utils::TempDb;
use crate::transaction_categories::TransactionCategoriesRepository;
use crate::transactions::TransactionsRepository;
use crate::write_actor::spawn_writer;
use chrono::{Datelike, Duration, NaiveDate, NaiveDateTime};
use diesel::r2d2::{self, Pool};
use diesel::sql_types::{BigInt, Text};
use diesel::{Connection, RunQueryDsl, SqliteConnection, sql_query};
use std::sync::{Arc, Mutex};
use zai_core::Error;
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetMeasurementMode, BudgetRolloverMode, NewBudget,
};
use zai_core::features::budgets::traits::{BudgetsRepositoryTrait, CalendarClock};
use zai_core::features::transactions::models::NewTransaction;
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;

struct ManualClock {
    now: Mutex<NaiveDateTime>,
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

#[derive(diesel::QueryableByName)]
struct ProjectionCounts {
    #[diesel(sql_type = BigInt)]
    configurations: i64,
    #[diesel(sql_type = BigInt)]
    results: i64,
    #[diesel(sql_type = Text)]
    latest_period_start: String,
}

fn date(year: i32, month: u32, day: u32) -> NaiveDateTime {
    NaiveDate::from_ymd_opt(year, month, day)
        .expect("date")
        .and_hms_opt(12, 0, 0)
        .expect("time")
}

fn projection_counts(conn: &mut SqliteConnection, budget_id: &str) -> ProjectionCounts {
    sql_query(
        "SELECT
            (SELECT COUNT(*) FROM budget_configurations WHERE budget_id = ?) AS configurations,
            (SELECT COUNT(*) FROM budget_period_results WHERE budget_id = ?) AS results,
            COALESCE(
                (SELECT period_start FROM budget_configurations
                 WHERE budget_id = ? ORDER BY period_start DESC LIMIT 1),
                ''
            ) AS latest_period_start",
    )
    .bind::<Text, _>(budget_id)
    .bind::<Text, _>(budget_id)
    .bind::<Text, _>(budget_id)
    .get_result(conn)
    .expect("projection counts")
}

fn daily_budget(id: &str) -> NewBudget {
    configured_budget(
        id,
        "Daily safety",
        100,
        BudgetCadence::Day,
        Vec::new(),
        BudgetMeasurementMode::Spending,
    )
}

#[tokio::test]
async fn clock_regression_rejects_sample_without_reopening_materialized_period() {
    let temp_db = TempDb::new();
    let march = date(2026, 3, 15);
    let january = date(2026, 1, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(march),
    });
    let (budgets, _, _) = setup_with_clock(&temp_db, clock.clone());
    budgets
        .create_budget(new_budget("clock-regression", "Clock regression", 1_000))
        .await
        .expect("budget");
    budgets
        .get_budget("clock-regression")
        .await
        .expect("materialize march");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    let before = projection_counts(&mut conn, "clock-regression");
    assert_eq!(before.configurations, 1);
    assert_eq!(before.results, 1);
    assert!(before.latest_period_start.starts_with("2026-03"));

    *clock.now.lock().expect("clock lock") = january;
    let error = budgets
        .get_budget("clock-regression")
        .await
        .expect_err("clock regression");
    assert!(matches!(error, Error::ClockRegression(_)));

    let after = projection_counts(&mut conn, "clock-regression");
    assert_eq!(after.configurations, before.configurations);
    assert_eq!(after.results, before.results);
    assert_eq!(after.latest_period_start, before.latest_period_start);
}

#[tokio::test]
async fn advancing_two_thousand_missing_periods_succeeds() {
    let temp_db = TempDb::new();
    let start = date(2020, 1, 1);
    let target = start + Duration::days(2_000);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(start),
    });
    let (budgets, _, _) = setup_with_clock(&temp_db, clock.clone());
    budgets
        .create_budget(daily_budget("advance-limit-ok"))
        .await
        .expect("budget");

    *clock.now.lock().expect("clock lock") = target;
    let budget = budgets
        .get_budget("advance-limit-ok")
        .await
        .expect("advance 2,000 periods");
    assert_eq!(budget.current_period.start.date().year(), target.year());
    assert_eq!(
        budget.current_period.start.date().ordinal(),
        target.date().ordinal()
    );

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    let counts = projection_counts(&mut conn, "advance-limit-ok");
    assert_eq!(counts.configurations, 2_001);
    assert_eq!(counts.results, 2_001);
}

#[tokio::test]
async fn advancing_two_thousand_one_missing_periods_returns_limit_error_without_partial_chain(
) {
    let temp_db = TempDb::new();
    let start = date(2020, 1, 1);
    let target = start + Duration::days(2_001);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(start),
    });
    let (budgets, _, _) = setup_with_clock(&temp_db, clock.clone());
    budgets
        .create_budget(daily_budget("advance-limit-fail"))
        .await
        .expect("budget");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    let before = projection_counts(&mut conn, "advance-limit-fail");

    *clock.now.lock().expect("clock lock") = target;
    let error = budgets
        .get_budget("advance-limit-fail")
        .await
        .expect_err("period advance limit");
    assert!(matches!(error, Error::PeriodAdvanceLimitExceeded(_)));

    let after = projection_counts(&mut conn, "advance-limit-fail");
    assert_eq!(after.configurations, before.configurations);
    assert_eq!(after.results, before.results);
    assert_eq!(after.latest_period_start, before.latest_period_start);
}

#[tokio::test]
async fn calculation_overflow_rejects_materialization_without_partial_commit() {
    let temp_db = TempDb::new();
    let january = date(2026, 1, 15);
    let february = date(2026, 2, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(january),
    });
    let (budgets, _, _) = setup_with_clock(&temp_db, clock.clone());
    let mut budget = new_budget("overflow", "Overflow", 100);
    budget.rollover_mode = Some(BudgetRolloverMode::PreviousPeriodOnly);
    budgets.create_budget(budget).await.expect("budget");
    budgets.get_budget("overflow").await.expect("materialize january");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    sql_query(
        "UPDATE budget_configurations
         SET base_allowance = 9223372036854775807
         WHERE budget_id = 'overflow' AND period_start LIKE '2026-01%'",
    )
    .execute(&mut conn)
    .expect("inflate previous configuration");
    sql_query(
        "UPDATE budget_period_results
         SET net_budget_spending = 1
         WHERE budget_id = 'overflow' AND period_start LIKE '2026-01%'",
    )
    .execute(&mut conn)
    .expect("inflate previous result");
    let before = projection_counts(&mut conn, "overflow");

    *clock.now.lock().expect("clock lock") = february;
    let error = budgets
        .get_budget("overflow")
        .await
        .expect_err("calculation overflow");
    assert!(matches!(error, Error::CalculationOverflow(_)));

    let after = projection_counts(&mut conn, "overflow");
    assert_eq!(after.configurations, before.configurations);
    assert_eq!(after.results, before.results);
    assert_eq!(after.latest_period_start, before.latest_period_start);
}

#[tokio::test]
async fn failed_overflow_during_transaction_repair_rolls_back_insert() {
    let temp_db = TempDb::new();
    let january = date(2026, 1, 15);
    let february = date(2026, 2, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(january),
    });
    let (budgets, transactions, _) = setup_with_clock(&temp_db, clock.clone());
    let mut budget = new_budget("overflow-rollback", "Overflow rollback", 100);
    budget.rollover_mode = Some(BudgetRolloverMode::PreviousPeriodOnly);
    budgets
        .create_budget(budget)
        .await
        .expect("budget");
    budgets
        .get_budget("overflow-rollback")
        .await
        .expect("materialize january");

    *clock.now.lock().expect("clock lock") = february;
    budgets
        .get_budget("overflow-rollback")
        .await
        .expect("materialize february");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    sql_query(
        "UPDATE budget_configurations
         SET base_allowance = 9223372036854775807
         WHERE budget_id = 'overflow-rollback' AND period_start LIKE '2026-01%'",
    )
    .execute(&mut conn)
    .expect("inflate january configuration");
    sql_query(
        "UPDATE budget_period_results
         SET net_budget_spending = 1
         WHERE budget_id = 'overflow-rollback' AND period_start LIKE '2026-01%'",
    )
    .execute(&mut conn)
    .expect("inflate january result");

    let error = transactions
        .create_transaction(NewTransaction {
            id: Some("overflow-trigger".to_string()),
            description: None,
            amount: 10,
            transaction_date: february,
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect_err("repair overflow");
    assert!(matches!(error, Error::CalculationOverflow(_)));

    let transactions = transactions
        .get_transactions(1, 50, None, None)
        .expect("transactions");
    assert!(transactions.data.is_empty());
}

#[tokio::test]
async fn projection_rebuild_is_deterministic_and_idempotent_under_mutations() {
    let temp_db = TempDb::new();
    let january = date(2026, 1, 15);
    let march = date(2026, 3, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(january),
    });
    let (budgets, transactions, _) = setup_with_clock(&temp_db, clock.clone());
    let mut budget = new_budget("idempotent", "Idempotent", 1_000);
    budget.rollover_mode = Some(BudgetRolloverMode::Cumulative);
    budgets.create_budget(budget).await.expect("budget");
    transactions
        .create_transaction(NewTransaction {
            id: Some("january-spend".to_string()),
            description: None,
            amount: 100,
            transaction_date: january,
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("january transaction");

    *clock.now.lock().expect("clock lock") = march;
    transactions
        .create_transaction(NewTransaction {
            id: Some("march-spend".to_string()),
            description: None,
            amount: 250,
            transaction_date: march,
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("march transaction");

    let baseline = budgets
        .get_budget_history("idempotent", 1, 50)
        .await
        .expect("baseline history");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    for _ in 0..2 {
        sql_query("DELETE FROM budget_period_results WHERE budget_id = 'idempotent'")
            .execute(&mut conn)
            .expect("clear results");
        let rebuilt = budgets
            .get_budget_history("idempotent", 1, 50)
            .await
            .expect("rebuild history");
        assert_eq!(rebuilt.data.len(), baseline.data.len());
        for (before, after) in baseline.data.iter().zip(&rebuilt.data) {
            assert_eq!(before.start, after.start);
            assert_eq!(before.end, after.end);
            assert_eq!(before.base_allowance, after.base_allowance);
            assert_eq!(before.effective_allowance, after.effective_allowance);
            assert_eq!(before.net_budget_spending, after.net_budget_spending);
            assert_eq!(before.remaining_allowance, after.remaining_allowance);
            assert_eq!(before.status, after.status);
        }
    }
}
