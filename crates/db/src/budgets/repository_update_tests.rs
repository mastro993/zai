use super::{new_budget, setup};
use crate::test_utils::TempDb;
use zai_core::Error;
use zai_core::features::budgets::models::{BudgetLifecycleUpdate, BudgetListFilter, BudgetUpdate};
use zai_core::features::budgets::traits::BudgetsRepositoryTrait;

#[tokio::test]
async fn updating_budget_replaces_open_configuration_and_increments_revision() {
    let temp_db = TempDb::new();
    let (budgets, _, _) = setup(&temp_db);
    let created = budgets
        .create_budget(new_budget("editable", "Monthly", 10_000))
        .await
        .expect("budget");

    let renamed = budgets
        .update_budget(
            "editable",
            BudgetUpdate {
                expected_revision: created.revision,
                name: "Renamed".to_string(),
                base_allowance: 10_000,
                cadence: created.cadence,
                category_ids: created.category_ids.clone(),
                measurement_mode: created.measurement_mode,
                rollover_mode: created.rollover_mode,
                warning_percentage: created.warning_percentage,
            },
        )
        .await
        .expect("rename and configuration update");

    assert_eq!(renamed.name, "Renamed");
    assert_eq!(renamed.revision, 1);
    assert_eq!(renamed.current_period.base_allowance, 10_000);

    let repeated = budgets
        .update_budget(
            "editable",
            BudgetUpdate {
                expected_revision: renamed.revision,
                name: renamed.name.clone(),
                base_allowance: 30_000,
                cadence: renamed.cadence,
                category_ids: renamed.category_ids.clone(),
                measurement_mode: renamed.measurement_mode,
                rollover_mode: renamed.rollover_mode,
                warning_percentage: renamed.warning_percentage,
            },
        )
        .await
        .expect("second configuration update");
    let history = budgets
        .get_budget_history("editable", 1, 50)
        .await
        .expect("history");

    assert_eq!(repeated.revision, 2);
    assert_eq!(repeated.current_period.base_allowance, 30_000);
    assert_eq!(history.data.len(), 1);
    assert_eq!(history.data[0].base_allowance, 30_000);
}

#[tokio::test]
async fn stale_budget_update_returns_current_revision_without_changing_budget() {
    let temp_db = TempDb::new();
    let (budgets, _, _) = setup(&temp_db);
    let created = budgets
        .create_budget(new_budget("stale", "Original", 10_000))
        .await
        .expect("budget");
    let updated = budgets
        .update_budget(
            "stale",
            BudgetUpdate {
                expected_revision: created.revision,
                name: "Current".to_string(),
                base_allowance: 10_000,
                cadence: created.cadence,
                category_ids: created.category_ids.clone(),
                measurement_mode: created.measurement_mode,
                rollover_mode: created.rollover_mode,
                warning_percentage: created.warning_percentage,
            },
        )
        .await
        .expect("first update");

    let error = budgets
        .update_budget(
            "stale",
            BudgetUpdate {
                expected_revision: created.revision,
                name: "Stale write".to_string(),
                base_allowance: 99_000,
                cadence: created.cadence,
                category_ids: created.category_ids,
                measurement_mode: created.measurement_mode,
                rollover_mode: created.rollover_mode,
                warning_percentage: created.warning_percentage,
            },
        )
        .await
        .expect_err("stale update should fail");
    let current = budgets.get_budget("stale").await.expect("budget");

    assert!(matches!(
        error,
        Error::RevisionConflict {
            current_revision: 1
        }
    ));
    assert_eq!(current.name, updated.name);
    assert_eq!(current.revision, 1);
    assert_eq!(current.current_period.base_allowance, 10_000);
}

#[tokio::test]
async fn pausing_hides_budget_from_active_list_and_resume_restores_it() {
    let temp_db = TempDb::new();
    let (budgets, _, _) = setup(&temp_db);
    let created = budgets
        .create_budget(new_budget("lifecycle", "Lifecycle", 10_000))
        .await
        .expect("budget");

    let paused = budgets
        .pause_budget(
            "lifecycle",
            BudgetLifecycleUpdate {
                expected_revision: created.revision,
            },
        )
        .await
        .expect("pause");

    assert!(paused.paused);
    assert_eq!(paused.revision, 1);
    assert!(
        budgets
            .list_budgets(BudgetListFilter::Active)
            .await
            .expect("active budgets")
            .is_empty()
    );
    assert_eq!(
        budgets
            .list_budgets(BudgetListFilter::Paused)
            .await
            .expect("paused budgets")
            .len(),
        1
    );
    assert_eq!(
        budgets
            .list_budgets(BudgetListFilter::All)
            .await
            .expect("all budgets")
            .len(),
        1
    );

    let resumed = budgets
        .resume_budget(
            "lifecycle",
            BudgetLifecycleUpdate {
                expected_revision: paused.revision,
            },
        )
        .await
        .expect("resume");

    assert!(!resumed.paused);
    assert_eq!(resumed.revision, 2);
    assert_eq!(
        budgets
            .list_budgets(BudgetListFilter::Active)
            .await
            .expect("active budgets")
            .len(),
        1
    );
}

#[tokio::test]
async fn stale_lifecycle_write_returns_current_revision() {
    let temp_db = TempDb::new();
    let (budgets, _, _) = setup(&temp_db);
    let created = budgets
        .create_budget(new_budget("stale-lifecycle", "Stale lifecycle", 10_000))
        .await
        .expect("budget");

    budgets
        .pause_budget(
            "stale-lifecycle",
            BudgetLifecycleUpdate {
                expected_revision: created.revision,
            },
        )
        .await
        .expect("pause");

    let error = budgets
        .resume_budget(
            "stale-lifecycle",
            BudgetLifecycleUpdate {
                expected_revision: created.revision,
            },
        )
        .await
        .expect_err("stale lifecycle write");

    assert!(matches!(
        error,
        Error::RevisionConflict {
            current_revision: 1
        }
    ));
}
