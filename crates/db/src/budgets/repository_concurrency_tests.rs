use super::BudgetsRepository;
use crate::connection::run_migrations;
use crate::test_utils::TempDb;
use crate::transaction_categories::TransactionCategoriesRepository;
use crate::transactions::TransactionsRepository;
use crate::write_actor::spawn_writer;
use diesel::r2d2::{self, Pool};
use std::sync::Arc;
use tokio::sync::Barrier;
use zai_core::{
    Error,
    features::budgets::models::{
        BudgetCadence, BudgetLifecycleUpdate, BudgetListFilter, BudgetMeasurementMode, BudgetUpdate,
        NewBudget,
    },
};
use zai_core::features::budgets::traits::BudgetsRepositoryTrait;

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

fn sample_budget(id: &str) -> NewBudget {
    NewBudget {
        id: Some(id.to_string()),
        name: "Concurrency".to_string(),
        base_allowance: 10_000,
        cadence: Some(BudgetCadence::Month),
        category_ids: Vec::new(),
        measurement_mode: Some(BudgetMeasurementMode::Spending),
        rollover_mode: None,
        warning_percentage: Some(80),
    }
}

#[tokio::test]
async fn concurrent_pause_requests_keep_single_revision_chain() {
    let temp_db = TempDb::new();
    let (budgets, _, _) = setup(&temp_db);
    let budgets = Arc::new(budgets);
    budgets
        .create_budget(sample_budget("concurrent-pause"))
        .await
        .expect("create budget");

    let barrier = Arc::new(Barrier::new(2));
    let left = {
        let budgets = Arc::clone(&budgets);
        let barrier = Arc::clone(&barrier);
        tokio::spawn(async move {
            barrier.wait().await;
            budgets
                .pause_budget(
                    "concurrent-pause",
                    BudgetLifecycleUpdate { expected_revision: 0 },
                )
                .await
        })
    };
    let right = {
        let budgets = Arc::clone(&budgets);
        let barrier = Arc::clone(&barrier);
        tokio::spawn(async move {
            barrier.wait().await;
            budgets
                .pause_budget(
                    "concurrent-pause",
                    BudgetLifecycleUpdate { expected_revision: 0 },
                )
                .await
        })
    };

    let (left, right) = tokio::try_join!(left, right).expect("join");
    let outcomes = [left, right];
    let successes = outcomes
        .iter()
        .filter(|result| result.is_ok())
        .count();
    let conflicts = outcomes
        .iter()
        .filter(|result| matches!(result, Err(Error::RevisionConflict { .. })))
        .count();

    assert_eq!(successes, 1);
    assert_eq!(conflicts, 1);

    let paused = budgets
        .get_budget("concurrent-pause")
        .await
        .expect("load paused budget");
    assert!(paused.paused);
    assert_eq!(paused.revision, 1);
}

#[tokio::test]
async fn concurrent_update_and_delete_keep_atomic_revision_outcomes() {
    let temp_db = TempDb::new();
    let (budgets, _, _) = setup(&temp_db);
    let budgets = Arc::new(budgets);
    budgets
        .create_budget(sample_budget("concurrent-delete"))
        .await
        .expect("create budget");

    let barrier = Arc::new(Barrier::new(2));
    let update = {
        let budgets = Arc::clone(&budgets);
        let barrier = Arc::clone(&barrier);
        tokio::spawn(async move {
            barrier.wait().await;
            budgets
                .update_budget(
                    "concurrent-delete",
                    BudgetUpdate {
                        expected_revision: 0,
                        name: "Updated".to_string(),
                        base_allowance: 20_000,
                        cadence: BudgetCadence::Month,
                        category_ids: Vec::new(),
                        measurement_mode: BudgetMeasurementMode::Spending,
                        rollover_mode: zai_core::features::budgets::models::BudgetRolloverMode::Off,
                        warning_percentage: Some(80),
                    },
                )
                .await
        })
    };
    let delete = {
        let budgets = Arc::clone(&budgets);
        let barrier = Arc::clone(&barrier);
        tokio::spawn(async move {
            barrier.wait().await;
            budgets
                .delete_budget(
                    "concurrent-delete",
                    BudgetLifecycleUpdate { expected_revision: 0 },
                )
                .await
        })
    };

    let (update_result, delete_result) = tokio::try_join!(update, delete).expect("join");
    let successes = [update_result.is_ok(), delete_result.is_ok()]
        .into_iter()
        .filter(|ok| *ok)
        .count();

    assert_eq!(successes, 1);
    let failure = if update_result.is_err() {
        update_result.as_ref().expect_err("update failure")
    } else {
        delete_result.as_ref().expect_err("delete failure")
    };
    assert!(
        matches!(
            failure,
            Error::RevisionConflict { .. }
                | Error::NotFound(_)
                | Error::Database(zai_core::DatabaseError::NotFound(_))
        ),
        "unexpected failure: {failure:?}"
    );

    let active = budgets
        .list_budgets(BudgetListFilter::All)
        .await
        .expect("list all");
    if active.is_empty() {
        let missing = budgets
            .get_budget("concurrent-delete")
            .await
            .expect_err("deleted budget should not load");
        assert!(
            matches!(
                missing,
                Error::NotFound(_) | Error::Database(zai_core::DatabaseError::NotFound(_))
            )
        );
    } else {
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].name, "Updated");
        assert_eq!(active[0].revision, 1);
    }
}

#[tokio::test]
async fn stale_successful_response_is_not_returned_after_losing_revision_race() {
    let temp_db = TempDb::new();
    let (budgets, _, _) = setup(&temp_db);
    let budgets = Arc::new(budgets);
    budgets
        .create_budget(sample_budget("stale-response"))
        .await
        .expect("create budget");

    let barrier = Arc::new(Barrier::new(2));
    let first = {
        let budgets = Arc::clone(&budgets);
        let barrier = Arc::clone(&barrier);
        tokio::spawn(async move {
            barrier.wait().await;
            budgets
                .pause_budget(
                    "stale-response",
                    BudgetLifecycleUpdate { expected_revision: 0 },
                )
                .await
        })
    };
    let second = {
        let budgets = Arc::clone(&budgets);
        let barrier = Arc::clone(&barrier);
        tokio::spawn(async move {
            barrier.wait().await;
            budgets
                .resume_budget(
                    "stale-response",
                    BudgetLifecycleUpdate { expected_revision: 0 },
                )
                .await
        })
    };

    let (first_result, second_result) = tokio::try_join!(first, second).expect("join");
    let outcomes = [first_result, second_result];
    let winner = outcomes
        .iter()
        .find_map(|result| result.as_ref().ok())
        .expect("one successful lifecycle write");
    let loser = outcomes
        .iter()
        .find_map(|result| result.as_ref().err())
        .expect("one revision conflict");

    assert!(matches!(loser, Error::RevisionConflict { .. }));
    assert_eq!(winner.revision, 1);

    let current = budgets
        .get_budget("stale-response")
        .await
        .expect("reload budget");
    assert_eq!(current.revision, winner.revision);
    assert_eq!(current.paused, winner.paused);
}
