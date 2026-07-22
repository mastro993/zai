use super::*;
use crate::features::budgets::models::{BudgetCadence, BudgetMeasurementMode, BudgetStatus};
use crate::features::recurring_transactions::models::{ScheduleIntervalUnit, ScheduleRule};
use chrono::NaiveDate;

fn dt(year: i32, month: u32, day: u32, hour: u32, min: u32) -> NaiveDateTime {
    NaiveDate::from_ymd_opt(year, month, day)
        .unwrap()
        .and_hms_opt(hour, min, 0)
        .unwrap()
}

fn budget(id: &str, name: &str) -> Budget {
    Budget {
        id: id.to_string(),
        name: name.to_string(),
        revision: 1,
        paused: false,
        category_ids: vec!["food".to_string()],
        cadence: BudgetCadence::Month,
        measurement_mode: BudgetMeasurementMode::Spending,
        base_allowance: 10_000,
        rollover_mode: BudgetRolloverMode::Off,
        warning_percentage: Some(80),
        current_period: BudgetPeriod {
            start: dt(2026, 1, 1, 0, 0),
            end: dt(2026, 2, 1, 0, 0),
            base_allowance: 10_000,
            effective_allowance: 10_000,
            net_budget_spending: 1_000,
            remaining_allowance: 9_000,
            status: BudgetStatus::OnTrack,
        },
    }
}

fn source(id: &str, head_local: NaiveDateTime, next_ordinal: i32) -> ProjectionSourceInput {
    ProjectionSourceInput {
        recurring: RecurringTransaction {
            id: id.to_string(),
            lifecycle: RecurringLifecycle::Active,
            total_occurrences: None,
            fulfilled_count: 0,
            revision: 1,
            lifecycle_changed_at: dt(2026, 1, 1, 0, 0),
            paused_at: None,
            created_at: dt(2026, 1, 1, 0, 0),
            updated_at: dt(2026, 1, 1, 0, 0),
            deleted_at: None,
        },
        head: RecurringOccurrenceHead {
            recurring_transaction_id: id.to_string(),
            schedule_revision_id: format!("{id}-sched"),
            next_ordinal,
            next_scheduled_local: head_local,
        },
        open_schedule: RecurringScheduleRevision {
            id: format!("{id}-sched"),
            recurring_transaction_id: id.to_string(),
            sequence: 1,
            effective_from_local: dt(2026, 1, 1, 0, 0),
            effective_until_local: None,
            first_scheduled_local: head_local,
            rule: ScheduleRule::Interval {
                every: 1,
                unit: ScheduleIntervalUnit::Month,
            },
        },
        unresolved_failure: None,
        templates_by_local: vec![(
            dt(2026, 1, 1, 0, 0),
            RecurringTemplateRevision {
                id: format!("{id}-tmpl"),
                recurring_transaction_id: id.to_string(),
                sequence: 1,
                effective_from_local: dt(2026, 1, 1, 0, 0),
                effective_until_local: None,
                description: "Rent".to_string(),
                amount: 2_000,
                transaction_type: "expense".to_string(),
                transaction_category_id: Some("food".to_string()),
                notes: None,
            },
        )],
    }
}

#[test]
fn overlapping_budgets_receive_independent_contributions() {
    let observed = dt(2026, 1, 5, 12, 0);
    let food = budget("b1", "Food");
    let mut all = budget("b2", "All");
    all.category_ids = vec![];
    let input = ProjectionComputeInput {
        observed_local: observed,
        horizon_months: 1,
        budgets: vec![
            ProjectionBudgetInput {
                scope_category_ids: food.category_ids.clone(),
                warning_percentage: food.warning_percentage,
                budget: food,
                stale: false,
            },
            ProjectionBudgetInput {
                scope_category_ids: vec![],
                warning_percentage: all.warning_percentage,
                budget: all,
                stale: false,
            },
        ],
        sources: vec![source("r1", dt(2026, 1, 15, 9, 0), 1)],
        category_roles: HashMap::from([("food".to_string(), CategoryRole::Spending)]),
        category_hierarchy: vec![CategoryHierarchy {
            id: "food".to_string(),
            parent_id: None,
        }],
        actual_spending: HashMap::new(),
        focus_recurring_transaction_id: None,
    };
    let result = compute_budget_projection(input).unwrap();
    assert!(result.complete);
    let jan: Vec<_> = result
        .periods
        .iter()
        .filter(|p| p.period_start == dt(2026, 1, 1, 0, 0))
        .collect();
    assert_eq!(jan.len(), 2);
    assert!(jan.iter().all(|p| p.projected_delta == 2_000));
}

#[test]
fn due_work_marks_incomplete_and_withholds_status() {
    let observed = dt(2026, 1, 20, 12, 0);
    let food = budget("b1", "Food");
    let input = ProjectionComputeInput {
        observed_local: observed,
        horizon_months: 1,
        budgets: vec![ProjectionBudgetInput {
            scope_category_ids: food.category_ids.clone(),
            warning_percentage: food.warning_percentage,
            budget: food,
            stale: false,
        }],
        sources: vec![source("r1", dt(2026, 1, 10, 9, 0), 1)],
        category_roles: HashMap::from([("food".to_string(), CategoryRole::Spending)]),
        category_hierarchy: vec![CategoryHierarchy {
            id: "food".to_string(),
            parent_id: None,
        }],
        actual_spending: HashMap::new(),
        focus_recurring_transaction_id: None,
    };
    let result = compute_budget_projection(input).unwrap();
    assert!(!result.complete);
    assert!(
        result
            .source_errors
            .iter()
            .any(|e| e.kind == ProjectionSourceErrorKind::DueCatchUp)
    );
    assert!(result.periods.iter().all(|p| p.status.is_none()));
}

#[test]
fn focused_query_limits_attribution_only() {
    let observed = dt(2026, 1, 5, 12, 0);
    let food = budget("b1", "Food");
    let mut input = ProjectionComputeInput {
        observed_local: observed,
        horizon_months: 1,
        budgets: vec![ProjectionBudgetInput {
            scope_category_ids: food.category_ids.clone(),
            warning_percentage: food.warning_percentage,
            budget: food,
            stale: false,
        }],
        sources: vec![
            source("r1", dt(2026, 1, 15, 9, 0), 1),
            source("r2", dt(2026, 1, 16, 9, 0), 1),
        ],
        category_roles: HashMap::from([("food".to_string(), CategoryRole::Spending)]),
        category_hierarchy: vec![CategoryHierarchy {
            id: "food".to_string(),
            parent_id: None,
        }],
        actual_spending: HashMap::new(),
        focus_recurring_transaction_id: None,
    };
    let global = compute_budget_projection(input.clone()).unwrap();
    input.focus_recurring_transaction_id = Some("r1".to_string());
    let focused = compute_budget_projection(input).unwrap();
    let global_period = &global.periods[0];
    let focused_period = &focused.periods[0];
    assert_eq!(
        global_period.projected_delta,
        focused_period.projected_delta
    );
    assert_eq!(
        global_period.forecast_net_budget_spending,
        focused_period.forecast_net_budget_spending
    );
    assert!(
        focused_period
            .attribution
            .iter()
            .all(|a| a.recurring_transaction_id == "r1")
    );
    assert!(focused_period.attribution.len() < global_period.attribution.len());
}

#[test]
fn partial_period_beyond_through_withholds_status() {
    let observed = dt(2026, 1, 20, 12, 0);
    let food = budget("b1", "Food");
    let input = ProjectionComputeInput {
        observed_local: observed,
        horizon_months: 1,
        budgets: vec![ProjectionBudgetInput {
            scope_category_ids: food.category_ids.clone(),
            warning_percentage: food.warning_percentage,
            budget: food,
            stale: false,
        }],
        sources: vec![],
        category_roles: HashMap::new(),
        category_hierarchy: vec![],
        actual_spending: HashMap::new(),
        focus_recurring_transaction_id: None,
    };
    let result = compute_budget_projection(input).unwrap();
    // through = Feb 20; Jan period ends Feb 1 (complete); Feb period ends Mar 1 (partial)
    let feb = result
        .periods
        .iter()
        .find(|p| p.period_start == dt(2026, 2, 1, 0, 0))
        .unwrap();
    assert!(feb.partial);
    assert_eq!(feb.covered_until, dt(2026, 2, 20, 12, 0));
    assert!(feb.status.is_none());
}
