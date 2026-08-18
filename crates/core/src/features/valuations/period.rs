use crate::features::budgets::models::{
    BudgetPeriod, BudgetRolloverMode, BudgetStatus, calculate_period_with_rollover,
};
use chrono::NaiveDateTime;

/// Completeness inputs that sit beside the existing complete-period calculator.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PeriodCompleteness {
    pub spending_complete: bool,
    pub allowance_complete: bool,
}

impl PeriodCompleteness {
    pub const COMPLETE: Self = Self {
        spending_complete: true,
        allowance_complete: true,
    };
}

/// Inputs for a completeness-aware period calculation.
pub struct PeriodCalculation<'a> {
    pub start: NaiveDateTime,
    pub end: NaiveDateTime,
    pub authored_allowance: i64,
    pub converted_allowance: Option<i64>,
    pub net_budget_spending: i64,
    pub rollover_mode: BudgetRolloverMode,
    pub previous_period: Option<&'a BudgetPeriod>,
    pub warning_percentage: Option<i32>,
    pub completeness: PeriodCompleteness,
}

/// Calculate a period result, failing closed when spending, allowance, or carry is unknown.
pub fn calculate_period_with_completeness(
    input: PeriodCalculation<'_>,
) -> crate::Result<BudgetPeriod> {
    let predecessor_blocks =
        predecessor_blocks_rollover(input.rollover_mode, input.previous_period);
    let allowance_complete =
        input.completeness.allowance_complete && input.converted_allowance.is_some();
    if !input.completeness.spending_complete || !allowance_complete || predecessor_blocks {
        return Ok(incomplete_period(
            input.start,
            input.end,
            input.authored_allowance,
            input.net_budget_spending,
        ));
    }
    let mut period = calculate_period_with_rollover(
        input.start,
        input.end,
        input.converted_allowance.expect("allowance complete"),
        input.net_budget_spending,
        input.rollover_mode,
        input.previous_period,
        input.warning_percentage,
    )?;
    period.base_allowance = input.authored_allowance;
    period.complete = true;
    Ok(period)
}

fn predecessor_blocks_rollover(
    rollover_mode: BudgetRolloverMode,
    previous_period: Option<&BudgetPeriod>,
) -> bool {
    match (rollover_mode, previous_period) {
        (_, None) | (BudgetRolloverMode::Off, _) => false,
        (_, Some(previous)) => !previous.complete,
    }
}

fn incomplete_period(
    start: NaiveDateTime,
    end: NaiveDateTime,
    authored_allowance: i64,
    net_budget_spending: i64,
) -> BudgetPeriod {
    BudgetPeriod {
        start,
        end,
        base_allowance: authored_allowance,
        effective_allowance: 0,
        net_budget_spending,
        remaining_allowance: 0,
        status: BudgetStatus::OnTrack,
        complete: false,
    }
}
