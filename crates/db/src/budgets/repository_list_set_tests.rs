use super::BudgetsRepository;
use crate::connection::run_migrations;
use crate::sql_statement_counter::ConnectionStatementCounter;
use crate::test_utils::TempDb;
use crate::transaction_categories::TransactionCategoriesRepository;
use crate::transactions::TransactionsRepository;
use crate::write_actor::spawn_writer;
use chrono::{NaiveDate, NaiveDateTime};
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sql_query;
use std::sync::{Arc, Mutex};
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetListFilter, BudgetMeasurementMode, NewBudget,
};
use zai_core::features::budgets::traits::{BudgetsRepositoryTrait, CalendarClock};

/// Current-only list uses a fixed batch of reads (budgets + configs + results).
const MAX_CURRENT_LIST_SQL_STATEMENTS: usize = 6;

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

async fn seed_current_budgets(
    budgets: &BudgetsRepository,
    start: usize,
    count: usize,
) -> Vec<String> {
    let mut ids = Vec::with_capacity(count);
    for index in start..start + count {
        let id = format!("stmt-budget-{index:02}");
        budgets
            .create_budget(NewBudget {
                id: Some(id.clone()),
                name: format!("Stmt budget {index:02}"),
                base_allowance: 10_000,
                cadence: Some(BudgetCadence::Month),
                category_ids: Vec::new(),
                measurement_mode: Some(BudgetMeasurementMode::Spending),
                rollover_mode: None,
                warning_percentage: Some(80),
            })
            .await
            .expect("create budget");
        ids.push(id);
    }
    ids
}

fn measure_list_projection_sql(db_path: &str, now: NaiveDateTime) -> (Vec<String>, usize) {
    let mut conn = diesel::SqliteConnection::establish(db_path).expect("connection");
    let counter = ConnectionStatementCounter::install(&mut conn);
    let projected = super::super::list_projection::project_budget_list(
        &mut conn,
        BudgetListFilter::Active,
        now,
    )
    .expect("project budget list");
    let ids = projected
        .into_iter()
        .map(|(id, state)| {
            assert!(
                matches!(
                    state,
                    super::super::list_projection::ProjectionState::Current(_)
                ),
                "expected current projection for {id}"
            );
            id
        })
        .collect();
    (ids, counter.count())
}

#[tokio::test]
async fn current_budget_list_sql_count_is_bounded_independent_of_n() {
    let temp_db = TempDb::new();
    let anchor = date(2026, 1, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(anchor),
    });
    let (budgets, _, _) = setup_with_clock(&temp_db, clock);
    let db_path = temp_db.path().to_string();

    let (empty_ids, empty_statements) = measure_list_projection_sql(&db_path, anchor);
    assert!(empty_ids.is_empty());
    assert!(
        empty_statements <= MAX_CURRENT_LIST_SQL_STATEMENTS,
        "empty list statements={empty_statements}"
    );

    seed_current_budgets(&budgets, 0, 1).await;
    let listed_one = budgets
        .list_budgets(BudgetListFilter::Active)
        .await
        .expect("list one");
    let detail_one = budgets
        .get_budget("stmt-budget-00")
        .await
        .expect("detail one");
    assert_eq!(listed_one.len(), 1);
    assert_eq!(listed_one[0].id, detail_one.id);
    assert_eq!(listed_one[0].name, detail_one.name);
    assert_eq!(listed_one[0].revision, detail_one.revision);
    assert_eq!(
        listed_one[0].current_period.start,
        detail_one.current_period.start
    );
    assert_eq!(
        listed_one[0].current_period.remaining_allowance,
        detail_one.current_period.remaining_allowance
    );
    let (one_ids, one_statements) = measure_list_projection_sql(&db_path, anchor);
    assert_eq!(one_ids, vec!["stmt-budget-00".to_string()]);
    assert!(
        one_statements <= MAX_CURRENT_LIST_SQL_STATEMENTS,
        "one-budget list statements={one_statements}"
    );

    seed_current_budgets(&budgets, 1, 9).await;
    let (ten_ids, ten_statements) = measure_list_projection_sql(&db_path, anchor);
    assert_eq!(ten_ids.len(), 10);
    assert_eq!(ten_ids[0], "stmt-budget-00");
    assert_eq!(ten_ids[9], "stmt-budget-09");
    assert!(
        ten_statements <= MAX_CURRENT_LIST_SQL_STATEMENTS,
        "ten-budget list statements={ten_statements}"
    );

    seed_current_budgets(&budgets, 10, 40).await;
    let listed_fifty = budgets
        .list_budgets(BudgetListFilter::Active)
        .await
        .expect("list fifty");
    assert_eq!(listed_fifty.len(), 50);
    let (fifty_ids, fifty_statements) = measure_list_projection_sql(&db_path, anchor);
    assert_eq!(
        fifty_ids,
        (0..50)
            .map(|index| format!("stmt-budget-{index:02}"))
            .collect::<Vec<_>>()
    );
    assert!(
        fifty_statements <= MAX_CURRENT_LIST_SQL_STATEMENTS,
        "fifty-budget list statements={fifty_statements}"
    );
    assert_eq!(
        ten_statements, fifty_statements,
        "current list SQL count must not grow with N"
    );
}

#[tokio::test]
async fn stale_budget_among_current_triggers_one_repair_path() {
    let temp_db = TempDb::new();
    let anchor = date(2026, 1, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(anchor),
    });
    let (budgets, _, _) = setup_with_clock(&temp_db, clock);
    seed_current_budgets(&budgets, 0, 10).await;

    let mut conn = diesel::SqliteConnection::establish(temp_db.path()).expect("connection");
    sql_query("DELETE FROM budget_period_results WHERE budget_id = 'stmt-budget-03'")
        .execute(&mut conn)
        .expect("delete one result");

    let before = super::super::list_projection::project_budget_list(
        &mut conn,
        BudgetListFilter::Active,
        anchor,
    )
    .expect("project before repair");
    let stale_before = before
        .iter()
        .filter(|(_, state)| {
            matches!(
                state,
                super::super::list_projection::ProjectionState::NeedsMaterialization
            )
        })
        .count();
    assert_eq!(stale_before, 1, "only one budget should be stale");

    let listed = budgets
        .list_budgets(BudgetListFilter::Active)
        .await
        .expect("list with one stale");
    assert_eq!(listed.len(), 10);
    assert!(
        listed.iter().any(|budget| budget.id == "stmt-budget-03"),
        "stale budget should be repaired and returned"
    );

    let after = super::super::list_projection::project_budget_list(
        &mut diesel::SqliteConnection::establish(temp_db.path()).expect("connection"),
        BudgetListFilter::Active,
        anchor,
    )
    .expect("project after repair");
    assert!(
        after.iter().all(|(_, state)| {
            matches!(
                state,
                super::super::list_projection::ProjectionState::Current(_)
            )
        }),
        "list repair should leave every budget current"
    );
}
