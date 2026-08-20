use super::{PeriodCalculation, PeriodCompleteness, calculate_period_with_completeness};
use crate::features::budgets::models::{BudgetPeriod, BudgetRolloverMode, BudgetStatus};
use chrono::NaiveDate;

fn bounds() -> (chrono::NaiveDateTime, chrono::NaiveDateTime) {
    let start = NaiveDate::from_ymd_opt(2026, 8, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();
    let end = NaiveDate::from_ymd_opt(2026, 9, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();
    (start, end)
}

fn complete_previous() -> BudgetPeriod {
    let (start, end) = bounds();
    BudgetPeriod {
        start,
        end,
        base_allowance: 1_000,
        effective_allowance: Some(1_000),
        net_budget_spending: 400,
        remaining_allowance: Some(600),
        status: Some(BudgetStatus::OnTrack),
        complete: true,
        currency: "EUR".to_string(),
    }
}

fn incomplete_previous() -> BudgetPeriod {
    let (start, end) = bounds();
    BudgetPeriod {
        start,
        end,
        base_allowance: 1_000,
        effective_allowance: None,
        net_budget_spending: 250,
        remaining_allowance: None,
        status: None,
        complete: false,
        currency: "EUR".to_string(),
    }
}

#[test]
fn pending_spending_keeps_known_sum_and_does_not_claim() {
    let (start, end) = bounds();
    let period = calculate_period_with_completeness(PeriodCalculation {
        start,
        end,
        authored_allowance: 2_000,
        converted_allowance: Some(2_000),
        net_budget_spending: 750,
        rollover_mode: BudgetRolloverMode::Off,
        previous_period: None,
        warning_percentage: Some(80),
        completeness: PeriodCompleteness {
            spending_complete: false,
            allowance_complete: true,
        },
    })
    .unwrap();
    assert!(!period.complete);
    assert_eq!(period.net_budget_spending, 750);
    assert_eq!(period.effective_allowance, None);
    assert_eq!(period.remaining_allowance, None);
    assert_eq!(period.status, None);
}

#[test]
fn missing_allowance_rate_is_incomplete() {
    let (start, end) = bounds();
    let period = calculate_period_with_completeness(PeriodCalculation {
        start,
        end,
        authored_allowance: 2_000,
        converted_allowance: None,
        net_budget_spending: 100,
        rollover_mode: BudgetRolloverMode::Off,
        previous_period: None,
        warning_percentage: None,
        completeness: PeriodCompleteness {
            spending_complete: true,
            allowance_complete: false,
        },
    })
    .unwrap();
    assert!(!period.complete);
}

#[test]
fn incomplete_predecessor_blocks_rollover_dependent_period() {
    let (start, end) = bounds();
    let previous = incomplete_previous();
    let period = calculate_period_with_completeness(PeriodCalculation {
        start,
        end,
        authored_allowance: 2_000,
        converted_allowance: Some(2_000),
        net_budget_spending: 0,
        rollover_mode: BudgetRolloverMode::Cumulative,
        previous_period: Some(&previous),
        warning_percentage: None,
        completeness: PeriodCompleteness::COMPLETE,
    })
    .unwrap();
    assert!(!period.complete);
    assert_eq!(period.net_budget_spending, 0);
}

#[test]
fn incomplete_predecessor_does_not_block_rollover_off() {
    let (start, end) = bounds();
    let previous = incomplete_previous();
    let period = calculate_period_with_completeness(PeriodCalculation {
        start,
        end,
        authored_allowance: 2_000,
        converted_allowance: Some(2_000),
        net_budget_spending: 100,
        rollover_mode: BudgetRolloverMode::Off,
        previous_period: Some(&previous),
        warning_percentage: None,
        completeness: PeriodCompleteness::COMPLETE,
    })
    .unwrap();
    assert!(period.complete);
    assert_eq!(period.effective_allowance, Some(2_000));
    assert_eq!(period.remaining_allowance, Some(1_900));
    assert_eq!(period.status, Some(BudgetStatus::OnTrack));
}

#[test]
fn complete_rollover_uses_predecessor_remaining() {
    let (start, end) = bounds();
    let previous = complete_previous();
    let period = calculate_period_with_completeness(PeriodCalculation {
        start,
        end,
        authored_allowance: 2_000,
        converted_allowance: Some(2_000),
        net_budget_spending: 100,
        rollover_mode: BudgetRolloverMode::Cumulative,
        previous_period: Some(&previous),
        warning_percentage: None,
        completeness: PeriodCompleteness::COMPLETE,
    })
    .unwrap();
    assert!(period.complete);
    assert_eq!(period.effective_allowance, Some(2_600));
    assert_eq!(period.remaining_allowance, Some(2_500));
}
