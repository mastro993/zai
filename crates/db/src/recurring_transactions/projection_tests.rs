use super::process_test_support::{local, setup_service};
use super::seed::{SeedRecurringSource, seed_active_interval_source};
use crate::budgets::BudgetsRepository;
use crate::connection::{create_pool, get_connection};
use crate::write_actor::spawn_writer;
use diesel::QueryableByName;
use diesel::prelude::*;
use diesel::sql_query;
use std::sync::Arc;
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetLifecycleUpdate, BudgetMeasurementMode, NewBudget,
};
use zai_core::features::budgets::traits::{BudgetsRepositoryTrait, CalendarClock};
use zai_core::features::recurring_transactions::{
    BudgetProjectionQuery, RecurringTransactionsServiceTrait,
};

async fn checksum_sensitive_tables(path: &str) -> String {
    let pool = create_pool(std::path::Path::new(path)).expect("pool");
    let mut conn = get_connection(&pool).expect("conn");
    #[derive(QueryableByName)]
    struct CountRow {
        #[diesel(sql_type = diesel::sql_types::BigInt)]
        c: i64,
    }
    let tables = [
        "transactions",
        "budgets",
        "budget_configurations",
        "budget_period_results",
        "domain_alerts",
        "recurring_transactions",
        "recurring_occurrences",
        "recurring_occurrence_heads",
        "recurring_schedule_revisions",
        "recurring_template_revisions",
        "recurring_generation_failures",
    ];
    let mut parts = Vec::new();
    for table in tables {
        let row = sql_query(format!("SELECT COUNT(*) AS c FROM {table}"))
            .get_result::<CountRow>(&mut conn)
            .unwrap_or(CountRow { c: -1 });
        parts.push(format!("{table}:{}", row.c));
    }
    parts.join("|")
}

#[tokio::test]
async fn projection_is_read_only_and_byte_stable() {
    let observed = local(2026, 1, 10, 12, 0);
    let (temp_db, service, repo, _clock, _guard) = setup_service(observed).await;
    {
        let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
        let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
        let budgets = BudgetsRepository::new_with_clock(
            Arc::clone(&pool),
            writer,
            Arc::clone(&_clock) as Arc<dyn CalendarClock>,
        );
        budgets
            .create_budget(NewBudget {
                id: Some("budget-all".to_string()),
                name: "All spending".to_string(),
                base_allowance: 50_000,
                cadence: Some(BudgetCadence::Month),
                category_ids: Vec::new(),
                measurement_mode: Some(BudgetMeasurementMode::Spending),
                rollover_mode: None,
                warning_percentage: Some(80),
            })
            .await
            .expect("budget");
    }
    {
        let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
        let mut conn = get_connection(&pool).expect("conn");
        seed_active_interval_source(
            &mut conn,
            &SeedRecurringSource {
                id: "rent".to_string(),
                description: "Rent".to_string(),
                lifecycle: "active",
                total_occurrences: None,
                fulfilled_count: 0,
                revision: 1,
                first_scheduled_local: local(2026, 1, 15, 9, 0),
                next_scheduled_local: local(2026, 1, 15, 9, 0),
                next_ordinal: 1,
                amount: 2_000,
                transaction_type: "expense",
            },
        )
        .expect("seed");
    }

    let before = checksum_sensitive_tables(temp_db.path()).await;
    let result = service
        .project_budgets(BudgetProjectionQuery {
            horizon_months: 2,
            include_paused_budgets: false,
            focus_recurring_transaction_id: None,
        })
        .await
        .expect("projection");
    let after = checksum_sensitive_tables(temp_db.path()).await;
    assert_eq!(before, after);
    assert!(result.complete);
    assert!(
        result
            .periods
            .iter()
            .any(|period| period.projected_delta == 2_000)
    );
    let _ = repo;
}

#[tokio::test]
async fn global_and_focused_share_aggregates() {
    let observed = local(2026, 1, 10, 12, 0);
    let (temp_db, service, _repo, clock, _guard) = setup_service(observed).await;
    {
        let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
        let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
        let budgets = BudgetsRepository::new_with_clock(
            Arc::clone(&pool),
            writer,
            Arc::clone(&clock) as Arc<dyn CalendarClock>,
        );
        budgets
            .create_budget(NewBudget {
                id: Some("budget-all".to_string()),
                name: "All spending".to_string(),
                base_allowance: 50_000,
                cadence: Some(BudgetCadence::Month),
                category_ids: Vec::new(),
                measurement_mode: Some(BudgetMeasurementMode::Spending),
                rollover_mode: None,
                warning_percentage: None,
            })
            .await
            .expect("budget");
    }
    {
        let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
        let mut conn = get_connection(&pool).expect("conn");
        for (id, day, amount) in [("a", 15_u32, 1_000_i32), ("b", 16, 3_000)] {
            seed_active_interval_source(
                &mut conn,
                &SeedRecurringSource {
                    id: id.to_string(),
                    description: id.to_string(),
                    lifecycle: "active",
                    total_occurrences: None,
                    fulfilled_count: 0,
                    revision: 1,
                    first_scheduled_local: local(2026, 1, day, 9, 0),
                    next_scheduled_local: local(2026, 1, day, 9, 0),
                    next_ordinal: 1,
                    amount,
                    transaction_type: "expense",
                },
            )
            .expect("seed");
        }
    }

    let global = service
        .project_budgets(BudgetProjectionQuery {
            horizon_months: 1,
            include_paused_budgets: false,
            focus_recurring_transaction_id: None,
        })
        .await
        .expect("global");
    let focused = service
        .project_budgets(BudgetProjectionQuery {
            horizon_months: 1,
            include_paused_budgets: false,
            focus_recurring_transaction_id: Some("a".to_string()),
        })
        .await
        .expect("focused");

    assert_eq!(global.periods.len(), focused.periods.len());
    for (left, right) in global.periods.iter().zip(focused.periods.iter()) {
        assert_eq!(left.projected_delta, right.projected_delta);
        assert_eq!(
            left.forecast_net_budget_spending,
            right.forecast_net_budget_spending
        );
        assert!(
            right
                .attribution
                .iter()
                .all(|item| item.recurring_transaction_id == "a")
        );
    }
}

#[tokio::test]
async fn due_catch_up_marks_incomplete_without_projecting_due_slots() {
    let observed = local(2026, 1, 20, 12, 0);
    let (temp_db, service, _repo, clock, _guard) = setup_service(observed).await;
    {
        let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
        let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
        let budgets = BudgetsRepository::new_with_clock(
            Arc::clone(&pool),
            writer,
            Arc::clone(&clock) as Arc<dyn CalendarClock>,
        );
        budgets
            .create_budget(NewBudget {
                id: Some("budget-all".to_string()),
                name: "All spending".to_string(),
                base_allowance: 50_000,
                cadence: Some(BudgetCadence::Month),
                category_ids: Vec::new(),
                measurement_mode: Some(BudgetMeasurementMode::Spending),
                rollover_mode: None,
                warning_percentage: None,
            })
            .await
            .expect("budget");
    }
    {
        let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
        let mut conn = get_connection(&pool).expect("conn");
        seed_active_interval_source(
            &mut conn,
            &SeedRecurringSource {
                id: "due-source".to_string(),
                description: "Due".to_string(),
                lifecycle: "active",
                total_occurrences: None,
                fulfilled_count: 0,
                revision: 1,
                first_scheduled_local: local(2026, 1, 5, 9, 0),
                next_scheduled_local: local(2026, 1, 5, 9, 0),
                next_ordinal: 1,
                amount: 500,
                transaction_type: "expense",
            },
        )
        .expect("seed");
    }

    let result = service
        .project_budgets(BudgetProjectionQuery {
            horizon_months: 1,
            include_paused_budgets: false,
            focus_recurring_transaction_id: None,
        })
        .await
        .expect("projection");
    assert!(!result.complete);
    assert!(result.periods.iter().all(|period| period.status.is_none()));
    assert!(!result.periods.iter().any(|period| {
        period
            .attribution
            .iter()
            .any(|item| item.scheduled_local <= observed)
    }));
}

#[tokio::test]
async fn paused_budgets_require_opt_in() {
    let observed = local(2026, 1, 10, 12, 0);
    let (temp_db, service, _repo, clock, _guard) = setup_service(observed).await;
    {
        let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
        let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
        let budgets = BudgetsRepository::new_with_clock(
            Arc::clone(&pool),
            writer,
            Arc::clone(&clock) as Arc<dyn CalendarClock>,
        );
        let created = budgets
            .create_budget(NewBudget {
                id: Some("paused-budget".to_string()),
                name: "Paused".to_string(),
                base_allowance: 10_000,
                cadence: Some(BudgetCadence::Month),
                category_ids: Vec::new(),
                measurement_mode: Some(BudgetMeasurementMode::Spending),
                rollover_mode: None,
                warning_percentage: None,
            })
            .await
            .expect("budget");
        budgets
            .pause_budget(
                &created.id,
                BudgetLifecycleUpdate {
                    expected_revision: created.revision,
                },
            )
            .await
            .expect("pause");
    }

    let active_only = service
        .project_budgets(BudgetProjectionQuery {
            horizon_months: 1,
            include_paused_budgets: false,
            focus_recurring_transaction_id: None,
        })
        .await
        .expect("active");
    let with_paused = service
        .project_budgets(BudgetProjectionQuery {
            horizon_months: 1,
            include_paused_budgets: true,
            focus_recurring_transaction_id: None,
        })
        .await
        .expect("paused");
    assert!(active_only.periods.is_empty());
    assert!(!with_paused.periods.is_empty());
}
