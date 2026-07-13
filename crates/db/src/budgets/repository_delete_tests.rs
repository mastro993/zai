use super::BudgetsRepository;
use crate::budgets::projection::rebuild_budget_projections;
use crate::connection::run_migrations;
use crate::schema::{budget_configurations, budget_period_results, budgets};
use crate::test_utils::TempDb;
use crate::transaction_categories::TransactionCategoriesRepository;
use crate::transactions::TransactionsRepository;
use crate::write_actor::spawn_writer;
use chrono::{NaiveDate, NaiveDateTime};
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::{Arc, Mutex};
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetLifecycleUpdate, BudgetListFilter, NewBudget,
};
use zai_core::features::budgets::traits::{BudgetsRepositoryTrait, CalendarClock};
use zai_core::features::transaction_categories::models::{
    CategoryChildrenDeleteStrategy, CategoryRole, NewTransactionCategory,
};
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;
use zai_core::features::transactions::models::NewTransaction;
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;
use zai_core::{DatabaseError, Error};

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

struct ManualClock {
    now: Mutex<NaiveDateTime>,
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
    BudgetsRepository,
    TransactionsRepository,
    TransactionCategoriesRepository,
) {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
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

#[tokio::test]
async fn tombstoning_hides_budget_retains_history_and_releases_name() {
    let temp_db = TempDb::new();
    let january = date(2026, 1, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(january),
    });
    let (budgets, _, _) = setup_with_clock(&temp_db, clock);
    let created = budgets
        .create_budget(new_budget("tombstone", "Monthly", 10_000))
        .await
        .expect("budget");

    budgets
        .delete_budget(
            "tombstone",
            BudgetLifecycleUpdate {
                expected_revision: created.revision,
            },
        )
        .await
        .expect("delete budget");

    for filter in [
        BudgetListFilter::Active,
        BudgetListFilter::Paused,
        BudgetListFilter::All,
    ] {
        assert!(
            budgets
                .list_budgets(filter)
                .await
                .expect("budget list")
                .is_empty()
        );
    }
    assert!(matches!(
        budgets.get_budget("tombstone").await,
        Err(Error::Database(DatabaseError::NotFound(_)))
    ));
    assert!(matches!(
        budgets.get_budget_history("tombstone", 1, 50).await,
        Err(Error::Database(DatabaseError::NotFound(_)))
    ));

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    let (deleted_at, revision) = budgets::table
        .find("tombstone")
        .select((budgets::deleted_at, budgets::revision))
        .first::<(Option<NaiveDateTime>, i64)>(&mut conn)
        .expect("tombstone row");
    assert_eq!(deleted_at, Some(january));
    assert_eq!(revision, 1);
    assert_eq!(
        budget_configurations::table
            .filter(budget_configurations::budget_id.eq("tombstone"))
            .count()
            .get_result::<i64>(&mut conn)
            .expect("configuration count"),
        1
    );
    assert_eq!(
        budget_period_results::table
            .filter(budget_period_results::budget_id.eq("tombstone"))
            .count()
            .get_result::<i64>(&mut conn)
            .expect("result count"),
        1
    );

    let replacement = budgets
        .create_budget(new_budget("replacement", "Monthly", 10_000))
        .await
        .expect("released name should be reusable");
    assert_ne!(replacement.id, created.id);
    assert_eq!(
        budgets
            .list_budgets(BudgetListFilter::All)
            .await
            .expect("budget list")
            .iter()
            .map(|budget| budget.id.as_str())
            .collect::<Vec<_>>(),
        vec!["replacement"]
    );
}

#[tokio::test]
async fn repeated_tombstoning_is_idempotent_and_preserves_original_timestamp() {
    let temp_db = TempDb::new();
    let january = date(2026, 1, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(january),
    });
    let (budgets, _, _) = setup_with_clock(&temp_db, clock.clone());
    budgets
        .create_budget(new_budget("retry", "Retry", 10_000))
        .await
        .expect("budget");
    budgets
        .delete_budget(
            "retry",
            BudgetLifecycleUpdate {
                expected_revision: 0,
            },
        )
        .await
        .expect("first delete");

    *clock.now.lock().expect("clock lock") = date(2026, 2, 15);
    budgets
        .delete_budget(
            "retry",
            BudgetLifecycleUpdate {
                expected_revision: 0,
            },
        )
        .await
        .expect("retry delete");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    let row = budgets::table
        .find("retry")
        .select((budgets::deleted_at, budgets::revision))
        .first::<(Option<NaiveDateTime>, i64)>(&mut conn)
        .expect("tombstone row");
    assert_eq!(row, (Some(january), 1));
}

#[tokio::test]
async fn stale_tombstone_is_rejected_without_mutation() {
    let temp_db = TempDb::new();
    let (budgets, _, _) = setup_with_clock(
        &temp_db,
        Arc::new(ManualClock {
            now: Mutex::new(date(2026, 1, 15)),
        }),
    );
    budgets
        .create_budget(new_budget("stale-delete", "Stale delete", 10_000))
        .await
        .expect("budget");

    let error = budgets
        .delete_budget(
            "stale-delete",
            BudgetLifecycleUpdate {
                expected_revision: 1,
            },
        )
        .await
        .expect_err("stale delete");
    assert!(matches!(
        error,
        Error::RevisionConflict {
            current_revision: 0
        }
    ));
    assert!(budgets.get_budget("stale-delete").await.is_ok());
}

#[tokio::test]
async fn tombstoned_budget_is_excluded_from_category_safeguards_and_repair() {
    let temp_db = TempDb::new();
    let january = date(2026, 1, 15);
    let clock = Arc::new(ManualClock {
        now: Mutex::new(january),
    });
    let (budgets, transactions, categories) = setup_with_clock(&temp_db, clock);
    let category = categories
        .create_category(NewTransactionCategory {
            id: Some("tombstone-category".to_string()),
            parent_id: None,
            name: "Tombstone category".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
        })
        .await
        .expect("category");
    let mut new_budget = new_budget("excluded", "Excluded", 10_000);
    new_budget.category_ids = vec![category.id.clone()];
    budgets.create_budget(new_budget).await.expect("budget");
    budgets
        .delete_budget(
            "excluded",
            BudgetLifecycleUpdate {
                expected_revision: 0,
            },
        )
        .await
        .expect("delete budget");

    categories
        .delete_categories(
            vec![category.id.as_str()],
            CategoryChildrenDeleteStrategy::Block,
            false,
        )
        .await
        .expect("tombstoned budget must not block category deletion");
    transactions
        .create_transaction(NewTransaction {
            id: Some("after-tombstone".to_string()),
            description: None,
            amount: 500,
            transaction_date: january,
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("transaction");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    assert_eq!(
        budget_period_results::table
            .filter(budget_period_results::budget_id.eq("excluded"))
            .select(budget_period_results::net_budget_spending)
            .first::<i64>(&mut conn)
            .expect("retained result"),
        0
    );
    rebuild_budget_projections(&mut conn, &["excluded".to_string()])
        .expect("tombstoned budget must be skipped by rebuild");
    assert_eq!(
        budget_period_results::table
            .filter(budget_period_results::budget_id.eq("excluded"))
            .select(budget_period_results::net_budget_spending)
            .first::<i64>(&mut conn)
            .expect("retained result"),
        0
    );
}
