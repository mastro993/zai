use super::*;
use crate::Error;
use chrono::NaiveDate;

fn sample_period() -> (NaiveDateTime, NaiveDateTime) {
    let start = NaiveDate::from_ymd_opt(2026, 7, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();
    let end = NaiveDate::from_ymd_opt(2026, 8, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();
    (start, end)
}

#[test]
fn budget_name_validation_trims_required_name_at_service_boundary() {
    let budget = NewBudget {
        id: None,
        name: "  July spending  ".to_string(),
        base_allowance: 10_000,
        cadence: None,
        category_ids: Vec::new(),
        measurement_mode: None,
        rollover_mode: None,
        warning_percentage: None,
    };

    budget.validate().expect("budget should validate");
    assert_eq!(normalize_budget_name(&budget.name), "July spending");
}

#[test]
fn budget_list_filter_defaults_to_active() {
    assert_eq!(BudgetListFilter::default(), BudgetListFilter::Active);
    assert_eq!(BudgetListFilter::Active.to_string(), "active");
    assert_eq!(BudgetListFilter::Paused.to_string(), "paused");
    assert_eq!(BudgetListFilter::All.to_string(), "all");
}

#[test]
fn lifecycle_request_rejects_negative_expected_revision() {
    let request = BudgetLifecycleUpdate {
        expected_revision: -1,
    };

    assert!(request.validate().is_err());
}

#[test]
fn warning_threshold_rounds_up_to_minor_unit() {
    let (start, end) = sample_period();
    let period = calculate_period(start, end, 1_001, 801, Some(80)).unwrap();

    assert_eq!(period.status, BudgetStatus::Warning);
}

#[test]
fn overspent_has_priority_over_warning() {
    let (start, end) = sample_period();
    let period = calculate_period(start, end, 1_000, 1_001, Some(80)).unwrap();

    assert_eq!(period.status, BudgetStatus::Overspent);
}

#[test]
fn rollover_modes_carry_signed_previous_results() {
    let (start, end) = sample_period();
    let previous = BudgetPeriod {
        start,
        end,
        base_allowance: 1_000,
        effective_allowance: -250,
        net_budget_spending: 1_250,
        remaining_allowance: -1_500,
        status: BudgetStatus::Overspent,
    };

    let previous_only = calculate_period_with_rollover(
        start,
        end,
        2_000,
        100,
        BudgetRolloverMode::PreviousPeriodOnly,
        Some(&previous),
        None,
    )
    .unwrap();
    let cumulative = calculate_period_with_rollover(
        start,
        end,
        2_000,
        100,
        BudgetRolloverMode::Cumulative,
        Some(&previous),
        None,
    )
    .unwrap();

    assert_eq!(previous_only.effective_allowance, 1_750);
    assert_eq!(cumulative.effective_allowance, 500);
}

#[test]
fn rollover_status_uses_signed_effective_allowance() {
    let (start, end) = sample_period();
    let previous = BudgetPeriod {
        start,
        end,
        base_allowance: 0,
        effective_allowance: -1,
        net_budget_spending: 1,
        remaining_allowance: -1,
        status: BudgetStatus::Overspent,
    };

    let period = calculate_period_with_rollover(
        start,
        end,
        0,
        0,
        BudgetRolloverMode::Cumulative,
        Some(&previous),
        Some(80),
    )
    .unwrap();

    assert_eq!(period.effective_allowance, -1);
    assert_eq!(period.status, BudgetStatus::Overspent);
}

#[test]
fn current_period_uses_half_open_local_calendar_boundaries() {
    let now = NaiveDate::from_ymd_opt(2024, 2, 29)
        .unwrap()
        .and_hms_opt(12, 30, 0)
        .unwrap();

    assert_eq!(
        current_period(now, BudgetCadence::Day).unwrap(),
        (
            NaiveDate::from_ymd_opt(2024, 2, 29)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 3, 1)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap(),
        )
    );
    assert_eq!(
        current_period(now, BudgetCadence::Week).unwrap(),
        (
            NaiveDate::from_ymd_opt(2024, 2, 26)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 3, 4)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap(),
        )
    );
    assert_eq!(
        current_period(now, BudgetCadence::Month).unwrap(),
        (
            NaiveDate::from_ymd_opt(2024, 2, 1)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 3, 1)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap(),
        )
    );
    assert_eq!(
        current_period(now, BudgetCadence::Year).unwrap(),
        (
            NaiveDate::from_ymd_opt(2024, 1, 1)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2025, 1, 1)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap(),
        )
    );
}

#[test]
fn checked_arithmetic_overflow_returns_structured_error() {
    let (start, end) = sample_period();
    let previous = BudgetPeriod {
        start,
        end,
        base_allowance: i64::MAX,
        effective_allowance: i64::MAX,
        net_budget_spending: 1,
        remaining_allowance: i64::MAX - 1,
        status: BudgetStatus::Overspent,
    };

    let error = calculate_period_with_rollover(
        start,
        end,
        2,
        0,
        BudgetRolloverMode::PreviousPeriodOnly,
        Some(&previous),
        None,
    )
    .expect_err("overflow");

    assert!(matches!(error, Error::CalculationOverflow(_)));
}

#[test]
fn category_scope_canonicalizes_redundant_ancestors_and_expands_descendants() {
    let categories = vec![
        CategoryHierarchy {
            id: "root".to_string(),
            parent_id: None,
        },
        CategoryHierarchy {
            id: "child".to_string(),
            parent_id: Some("root".to_string()),
        },
        CategoryHierarchy {
            id: "grandchild".to_string(),
            parent_id: Some("child".to_string()),
        },
    ];
    let selected = vec![
        "grandchild".to_string(),
        "root".to_string(),
        "child".to_string(),
    ];

    assert_eq!(
        canonicalize_category_ids(&selected, &categories),
        vec!["root".to_string()]
    );
    assert_eq!(
        expand_category_scope(&["root".to_string()], &categories),
        vec![
            "child".to_string(),
            "grandchild".to_string(),
            "root".to_string()
        ]
    );
}
