use super::BudgetsRepository;
use crate::connection::run_migrations;
use crate::test_utils::TempDb;
use crate::transaction_categories::TransactionCategoriesRepository;
use crate::transactions::TransactionsRepository;
use crate::write_actor::{reset_writer_exec_count, spawn_writer, writer_exec_count};
use chrono::{Datelike, Duration, NaiveDate, NaiveDateTime};
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sql_query;
use diesel::sql_types::{BigInt, Integer, Text};
use std::sync::{Arc, Mutex};
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetListFilter, BudgetMeasurementMode, NewBudget,
};
use zai_core::features::budgets::traits::{BudgetsRepositoryTrait, CalendarClock};

struct ManualClock {
    now: Mutex<NaiveDateTime>,
}

impl CalendarClock for ManualClock {
    fn sample(&self) -> NaiveDateTime {
        *self.now.lock().expect("clock lock")
    }
}

#[derive(Debug, diesel::QueryableByName)]
#[allow(dead_code)]
struct ExplainQueryPlanRow {
    #[diesel(sql_type = Integer)]
    id: i32,
    #[diesel(sql_type = Integer)]
    parent: i32,
    #[diesel(sql_type = Integer)]
    notused: i32,
    #[diesel(sql_type = Text)]
    detail: String,
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
        TransactionCategoriesRepository::new_with_clock(pool, writer, clock),
    )
}

fn date(year: i32, month: u32, day: u32) -> NaiveDateTime {
    NaiveDate::from_ymd_opt(year, month, day)
        .expect("date")
        .and_hms_opt(12, 0, 0)
        .expect("time")
}

fn explain_plan(
    conn: &mut diesel::sqlite::SqliteConnection,
    sql: &str,
) -> Vec<ExplainQueryPlanRow> {
    sql_query(format!("EXPLAIN QUERY PLAN {sql}"))
        .load(conn)
        .expect("explain query plan")
}

fn assert_uses_index(plan: &[ExplainQueryPlanRow], index_name: &str) {
    assert!(
        plan.iter().any(|row| row.detail.contains(index_name)),
        "expected {index_name} in query plan: {plan:?}"
    );
}

fn assert_avoids_transaction_scan(plan: &[ExplainQueryPlanRow]) {
    assert!(
        !plan.iter().any(|row| {
            row.detail.contains("SCAN TABLE transactions")
                || row.detail.contains("SCAN transactions")
        }),
        "expected no transaction table scan: {plan:?}"
    );
}

fn bulk_seed_transactions(conn: &mut diesel::sqlite::SqliteConnection, count: usize) {
    const BATCH: usize = 500;
    let mut remaining = count;
    let mut offset = 0_usize;
    while remaining > 0 {
        let batch = remaining.min(BATCH);
        let mut values = String::new();
        for index in 0..batch {
            if index > 0 {
                values.push(',');
            }
            let id = format!("perf-txn-{offset}");
            values.push_str(&format!(
                "('{id}', 'Perf transaction {offset}', 100, '2026-01-15T12:00:00', 'expense', NULL, NULL, '2026-01-01T00:00:00', '2026-01-01T00:00:00', NULL)"
            ));
            offset += 1;
        }
        let statement = format!(
            "INSERT INTO transactions (id, description, amount, transaction_date, transaction_type, transaction_category_id, notes, created_at, updated_at, deleted_at) VALUES {values}"
        );
        diesel::sql_query(statement)
            .execute(conn)
            .expect("bulk insert");
        remaining -= batch;
    }
}

async fn seed_performance_fixture(temp_db: &TempDb, budgets: &BudgetsRepository) -> String {
    let mut conn = diesel::SqliteConnection::establish(temp_db.path()).expect("connection");
    bulk_seed_transactions(&mut conn, 100_000);

    let mut first_id = String::new();
    for index in 0..50 {
        let id = format!("perf-budget-{index:02}");
        if index == 0 {
            first_id.clone_from(&id);
        }
        budgets
            .create_budget(NewBudget {
                id: Some(id),
                name: format!("Perf budget {index:02}"),
                base_allowance: 10_000,
                cadence: Some(BudgetCadence::Month),
                category_ids: Vec::new(),
                measurement_mode: Some(BudgetMeasurementMode::Spending),
                rollover_mode: None,
                warning_percentage: Some(80),
            })
            .await
            .expect("create budget");
    }
    first_id
}

#[tokio::test]
async fn list_and_detail_reads_avoid_transaction_scans_and_writer_for_current_budgets() {
    let temp_db = TempDb::new();
    let anchor = date(2026, 1, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(anchor),
    });
    let (budgets, _, _) = setup_with_clock(&temp_db, clock);
    let first_id = seed_performance_fixture(&temp_db, &budgets).await;

    reset_writer_exec_count();
    let listed = budgets
        .list_budgets(BudgetListFilter::Active)
        .await
        .expect("list budgets");
    assert_eq!(listed.len(), 50);
    assert_eq!(
        writer_exec_count(),
        0,
        "current list reads should not acquire writer"
    );

    reset_writer_exec_count();
    let detail = budgets.get_budget(&first_id).await.expect("get budget");
    assert_eq!(detail.id, first_id);
    assert_eq!(
        writer_exec_count(),
        0,
        "current detail reads should not acquire writer"
    );

    let mut conn = diesel::SqliteConnection::establish(temp_db.path()).expect("connection");
    let list_plan = explain_plan(
        &mut conn,
        "SELECT id FROM budgets WHERE deleted_at IS NULL AND paused = 0 ORDER BY name ASC, id ASC",
    );
    assert_uses_index(&list_plan, "budgets");

    let history_plan = explain_plan(
        &mut conn,
        "SELECT budget_period_results.budget_id \
         FROM budget_period_results \
         INNER JOIN budget_configurations \
           ON budget_period_results.budget_id = budget_configurations.budget_id \
          AND budget_period_results.period_start = budget_configurations.period_start \
         WHERE budget_period_results.budget_id = 'perf-budget-00' \
         ORDER BY budget_period_results.period_start DESC \
         LIMIT 50 OFFSET 0",
    );
    assert_uses_index(&history_plan, "budget_period_results_budget_period_index");
    assert_avoids_transaction_scan(&history_plan);
}

#[tokio::test]
async fn transaction_matching_uses_range_index_and_staleness_detection_is_set_based() {
    let temp_db = TempDb::new();
    let anchor = date(2026, 1, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(anchor),
    });
    let (budgets, _, _) = setup_with_clock(&temp_db, clock);
    seed_performance_fixture(&temp_db, &budgets).await;

    let mut conn = diesel::SqliteConnection::establish(temp_db.path()).expect("connection");
    let matching_plan = explain_plan(
        &mut conn,
        "SELECT amount, transaction_type, role \
         FROM transactions \
         LEFT JOIN transaction_categories ON transactions.transaction_category_id = transaction_categories.id \
         WHERE transactions.deleted_at IS NULL \
           AND transactions.transaction_date >= '2026-01-01T00:00:00' \
           AND transactions.transaction_date < '2026-02-01T00:00:00'",
    );
    assert_uses_index(&matching_plan, "transactions_active_date_index");

    let configuration_count_plan = explain_plan(
        &mut conn,
        "SELECT COUNT(*) FROM budget_configurations WHERE budget_id = 'perf-budget-00'",
    );
    let result_count_plan = explain_plan(
        &mut conn,
        "SELECT COUNT(*) FROM budget_period_results WHERE budget_id = 'perf-budget-00'",
    );
    assert!(
        configuration_count_plan
            .iter()
            .chain(result_count_plan.iter())
            .any(|row| {
                row.detail.contains("USING INDEX")
                    || row.detail.contains("USING COVERING INDEX")
                    || row.detail.contains("SEARCH")
            }),
        "expected set-based staleness counts to use indexed lookups: configurations={configuration_count_plan:?} results={result_count_plan:?}"
    );
}

#[derive(diesel::QueryableByName)]
struct ProjectionCounts {
    #[diesel(sql_type = BigInt)]
    configurations: i64,
    #[diesel(sql_type = BigInt)]
    results: i64,
}

#[tokio::test]
async fn two_thousand_period_catch_up_remains_bounded_and_batched() {
    let temp_db = TempDb::new();
    let start = date(2020, 1, 1);
    let target = start + Duration::days(2_000);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(start),
    });
    let (budgets, _, _) = setup_with_clock(&temp_db, clock.clone());
    budgets
        .create_budget(NewBudget {
            id: Some("perf-advance-limit".to_string()),
            name: "Perf advance".to_string(),
            base_allowance: 100,
            cadence: Some(BudgetCadence::Day),
            category_ids: Vec::new(),
            measurement_mode: Some(BudgetMeasurementMode::Spending),
            rollover_mode: None,
            warning_percentage: Some(80),
        })
        .await
        .expect("create budget");

    *clock.now.lock().expect("clock lock") = target;
    let budget = budgets
        .get_budget("perf-advance-limit")
        .await
        .expect("advance 2,000 periods");
    assert_eq!(budget.current_period.start.date().year(), target.year());
    assert_eq!(
        budget.current_period.start.date().ordinal(),
        target.date().ordinal()
    );

    let mut conn = diesel::SqliteConnection::establish(temp_db.path()).expect("connection");
    let counts = sql_query(
        "SELECT
            (SELECT COUNT(*) FROM budget_configurations WHERE budget_id = 'perf-advance-limit') AS configurations,
            (SELECT COUNT(*) FROM budget_period_results WHERE budget_id = 'perf-advance-limit') AS results",
    )
    .get_result::<ProjectionCounts>(&mut conn)
    .expect("projection counts");
    assert_eq!(counts.configurations, 2_001);
    assert_eq!(counts.results, 2_001);
}
