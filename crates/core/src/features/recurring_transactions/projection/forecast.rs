use super::contribute::{category_in_scope, signed_contribution};
use super::enumerate::{ProjectedSlot, enumerate_projected_slots};
use super::types::{
    BudgetPeriodForecast, BudgetProjectionResult, ProjectedOccurrenceAttribution,
    ProjectionSourceError, ProjectionSourceErrorKind,
};
use super::window::{ProjectionWindow, projection_window};
use crate::Result;
use crate::features::budgets::models::{
    Budget, BudgetPeriod, BudgetRolloverMode, CategoryHierarchy, current_period,
    expand_category_scope,
};
use crate::features::recurring_transactions::models::{
    RecurringGenerationFailure, RecurringLifecycle, RecurringOccurrenceHead,
    RecurringScheduleRevision, RecurringTemplateRevision, RecurringTransaction,
};
use crate::features::transaction_categories::models::CategoryRole;
use crate::features::valuations::{
    PeriodCalculation, PeriodCompleteness, ProjectionQuote, calculate_period_with_completeness,
    convert_projected,
};
use crate::money::{CurrencyCode, Money};
use chrono::NaiveDateTime;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ProjectionBudgetInput {
    pub budget: Budget,
    pub scope_category_ids: Vec<String>,
    pub warning_percentage: Option<i32>,
    pub stale: bool,
}

#[derive(Debug, Clone)]
pub struct ProjectionSourceInput {
    pub recurring: RecurringTransaction,
    pub head: RecurringOccurrenceHead,
    pub open_schedule: RecurringScheduleRevision,
    pub unresolved_failure: Option<RecurringGenerationFailure>,
    pub templates_by_local: Vec<(NaiveDateTime, RecurringTemplateRevision)>,
}

#[derive(Debug, Clone)]
pub struct ProjectionComputeInput {
    pub observed_local: NaiveDateTime,
    pub horizon_months: u32,
    pub budgets: Vec<ProjectionBudgetInput>,
    pub sources: Vec<ProjectionSourceInput>,
    pub category_roles: HashMap<String, CategoryRole>,
    pub category_hierarchy: Vec<CategoryHierarchy>,
    pub actual_spending: HashMap<(String, NaiveDateTime), i64>,
    pub focus_recurring_transaction_id: Option<String>,
    pub rates: ProjectionRateContext,
}

#[derive(Debug, Clone, Default)]
pub struct ProjectionRateContext {
    pub target_currency: String,
    pub quotes: HashMap<String, ProjectionQuote>,
}

#[derive(Debug, Clone)]
struct ResolvedProjectedOccurrence {
    recurring_transaction_id: String,
    schedule_revision_id: String,
    ordinal: i32,
    scheduled_local: NaiveDateTime,
    description: String,
    amount: i32,
    currency: String,
    transaction_type: String,
    transaction_category_id: Option<String>,
}

pub fn compute_budget_projection(input: ProjectionComputeInput) -> Result<BudgetProjectionResult> {
    let window = projection_window(input.observed_local, input.horizon_months)?;
    let mut source_errors = Vec::new();
    let mut complete = true;

    let mut projected = Vec::new();
    for source in &input.sources {
        if source.recurring.lifecycle != RecurringLifecycle::Active
            || source.recurring.deleted_at.is_some()
        {
            continue;
        }

        if source.head.next_scheduled_local <= window.observed_local {
            complete = false;
            source_errors.push(ProjectionSourceError {
                kind: ProjectionSourceErrorKind::DueCatchUp,
                recurring_transaction_id: Some(source.recurring.id.clone()),
                budget_id: None,
                message: "Due catch-up work remains before projection".to_string(),
            });
        }

        if source.unresolved_failure.is_some() {
            complete = false;
            source_errors.push(ProjectionSourceError {
                kind: ProjectionSourceErrorKind::GenerationBlocked,
                recurring_transaction_id: Some(source.recurring.id.clone()),
                budget_id: None,
                message: "Generation-blocked source excluded from projection".to_string(),
            });
            continue;
        }

        let remaining = source
            .recurring
            .total_occurrences
            .map(|total| (total - source.recurring.fulfilled_count).max(0));
        let slots = enumerate_projected_slots(
            &source.open_schedule.rule,
            source.open_schedule.first_scheduled_local,
            source.head.next_ordinal,
            source.head.next_scheduled_local,
            remaining,
            window.observed_local,
            window.through_local,
        )?;

        let mut revision_error = None;
        for slot in slots {
            match resolve_template(source, slot) {
                Ok(occurrence) => projected.push(occurrence),
                Err(error) => revision_error = Some(error),
            }
        }
        complete &= revision_error.is_none();
        source_errors.extend(revision_error);
    }

    let mut periods = Vec::new();
    for budget_input in &input.budgets {
        if budget_input.stale {
            complete = false;
            source_errors.push(ProjectionSourceError {
                kind: ProjectionSourceErrorKind::StaleBudgetTimeline,
                recurring_transaction_id: None,
                budget_id: Some(budget_input.budget.id.clone()),
                message: "Budget timeline is stale and cannot authoritatively forecast".to_string(),
            });
        }

        let scope_ids = if budget_input.scope_category_ids.is_empty() {
            Vec::new()
        } else {
            expand_category_scope(&budget_input.scope_category_ids, &input.category_hierarchy)
        };

        let (budget_periods, omitted) = forecast_budget_periods(
            budget_input,
            &scope_ids,
            &window,
            &projected,
            &input.category_roles,
            &input.actual_spending,
            complete && !budget_input.stale,
            &input.rates,
        )?;
        if omitted {
            complete = false;
        }
        periods.extend(budget_periods);
    }

    let mut result = BudgetProjectionResult {
        observed_local: window.observed_local,
        through_local: window.through_local,
        horizon_months: window.horizon_months,
        complete,
        currency: input.rates.target_currency.clone(),
        periods,
        source_errors,
    };
    if let Some(focus_id) = input.focus_recurring_transaction_id.as_deref() {
        result = result.focused_attribution(focus_id);
    }
    Ok(result)
}

fn resolve_template(
    source: &ProjectionSourceInput,
    slot: ProjectedSlot,
) -> std::result::Result<ResolvedProjectedOccurrence, ProjectionSourceError> {
    let matching: Vec<_> = source
        .templates_by_local
        .iter()
        .filter(|(_, template)| {
            template.effective_from_local <= slot.scheduled_local
                && template
                    .effective_until_local
                    .is_none_or(|until| slot.scheduled_local < until)
        })
        .collect();
    let Some((effective_from, template)) = matching.first().copied() else {
        return Err(ProjectionSourceError {
            kind: ProjectionSourceErrorKind::MissingRevision,
            recurring_transaction_id: Some(source.recurring.id.clone()),
            budget_id: None,
            message: "Missing template revision for projected occurrence".to_string(),
        });
    };
    if matching.len() != 1
        || *effective_from != template.effective_from_local
        || template.recurring_transaction_id != source.recurring.id
        || template.id.trim().is_empty()
        || template.sequence < 1
        || template
            .effective_until_local
            .is_some_and(|until| until <= template.effective_from_local)
        || template.description.trim().is_empty()
        || template.amount < 0
        || !matches!(template.transaction_type.as_str(), "expense" | "income")
    {
        return Err(ProjectionSourceError {
            kind: ProjectionSourceErrorKind::MissingRevision,
            recurring_transaction_id: Some(source.recurring.id.clone()),
            budget_id: None,
            message: "Invalid template revision for projected occurrence".to_string(),
        });
    }
    Ok(ResolvedProjectedOccurrence {
        recurring_transaction_id: source.recurring.id.clone(),
        schedule_revision_id: source.open_schedule.id.clone(),
        ordinal: slot.ordinal,
        scheduled_local: slot.scheduled_local,
        description: template.description.clone(),
        amount: template.amount,
        currency: template.currency.clone(),
        transaction_type: template.transaction_type.clone(),
        transaction_category_id: template.transaction_category_id.clone(),
    })
}

#[allow(clippy::too_many_arguments)]
fn forecast_budget_periods(
    budget_input: &ProjectionBudgetInput,
    scope_ids: &[String],
    window: &ProjectionWindow,
    projected: &[ResolvedProjectedOccurrence],
    category_roles: &HashMap<String, CategoryRole>,
    actual_spending: &HashMap<(String, NaiveDateTime), i64>,
    may_emit_status: bool,
    rates: &ProjectionRateContext,
) -> Result<(Vec<BudgetPeriodForecast>, bool)> {
    let budget = &budget_input.budget;
    let mut periods = Vec::new();
    let mut previous: Option<BudgetPeriod> = None;
    let mut period_start = budget.current_period.start;
    let mut period_end = budget.current_period.end;
    let mut is_first = true;
    let mut omitted = false;
    let mut guard = 0_u32;

    while period_start < window.through_local {
        guard = guard.saturating_add(1);
        if guard > 2_000 {
            return Err(crate::Error::PeriodAdvanceLimitExceeded(
                "Forecast period advance exceeds the 2,000-period limit".to_string(),
            ));
        }

        let partial = period_end > window.through_local;
        let covered_until = if partial {
            window.through_local
        } else {
            period_end
        };

        let actual = if is_first {
            actual_spending
                .get(&(budget.id.clone(), period_start))
                .copied()
                .unwrap_or(budget.current_period.net_budget_spending)
        } else {
            actual_spending
                .get(&(budget.id.clone(), period_start))
                .copied()
                .unwrap_or(0)
        };

        let mut attribution = Vec::new();
        let mut projected_delta = 0_i64;
        for occurrence in projected {
            if occurrence.scheduled_local < period_start
                || occurrence.scheduled_local >= period_end
                || occurrence.scheduled_local <= window.observed_local
                || occurrence.scheduled_local >= window.through_local
            {
                continue;
            }
            if !category_in_scope(occurrence.transaction_category_id.as_deref(), scope_ids) {
                continue;
            }
            let role = occurrence
                .transaction_category_id
                .as_ref()
                .and_then(|id| category_roles.get(id).copied());
            let Some(converted_amount) =
                convert_occurrence_amount(occurrence, rates, &mut omitted)?
            else {
                continue;
            };
            let contribution = signed_contribution(
                converted_amount,
                &occurrence.transaction_type,
                role,
                budget.measurement_mode,
            );
            projected_delta = projected_delta.checked_add(contribution).ok_or_else(|| {
                crate::Error::CalculationOverflow("Budget calculation overflow".to_string())
            })?;
            attribution.push(ProjectedOccurrenceAttribution {
                recurring_transaction_id: occurrence.recurring_transaction_id.clone(),
                schedule_revision_id: occurrence.schedule_revision_id.clone(),
                ordinal: occurrence.ordinal,
                scheduled_local: occurrence.scheduled_local,
                description: occurrence.description.clone(),
                contribution,
            });
        }

        let forecast_net = actual.checked_add(projected_delta).ok_or_else(|| {
            crate::Error::CalculationOverflow("Budget calculation overflow".to_string())
        })?;

        let rollover_seed = if is_first {
            Some(seed_previous_for_current(budget)?)
        } else {
            previous.clone()
        };

        let computed = calculate_period_with_completeness(PeriodCalculation {
            start: period_start,
            end: period_end,
            authored_allowance: budget.base_allowance,
            converted_allowance: Some(budget.base_allowance),
            net_budget_spending: forecast_net,
            rollover_mode: budget.rollover_mode,
            previous_period: rollover_seed.as_ref(),
            warning_percentage: budget_input.warning_percentage,
            completeness: PeriodCompleteness {
                spending_complete: budget.current_period.complete || !is_first,
                allowance_complete: true,
            },
        })?;

        let emit_status = may_emit_status && !partial && computed.complete && !omitted;
        periods.push(BudgetPeriodForecast {
            budget_id: budget.id.clone(),
            budget_name: budget.name.clone(),
            period_start,
            period_end,
            cadence: budget.cadence,
            measurement_mode: budget.measurement_mode,
            rollover_mode: budget.rollover_mode,
            base_allowance: budget.base_allowance,
            actual_net_budget_spending: actual,
            projected_delta,
            forecast_net_budget_spending: forecast_net,
            effective_allowance: computed.effective_allowance,
            remaining_allowance: computed.remaining_allowance,
            status: if emit_status {
                computed.status
            } else {
                None
            },
            partial,
            covered_until,
            attribution,
        });

        previous = Some(computed);
        is_first = false;
        let next = current_period(period_end, budget.cadence)?;
        period_start = next.0;
        period_end = next.1;
    }

    Ok((periods, omitted))
}

fn convert_occurrence_amount(
    occurrence: &ResolvedProjectedOccurrence,
    rates: &ProjectionRateContext,
    omitted: &mut bool,
) -> Result<Option<i32>> {
    if rates.target_currency.is_empty() || occurrence.currency == rates.target_currency {
        return Ok(Some(occurrence.amount));
    }
    let source = Money::from_authored(occurrence.amount, &occurrence.currency)?;
    let target = CurrencyCode::parse(&rates.target_currency)?;
    let converted = convert_projected(source, target, rates.quotes.get(&occurrence.currency))?;
    if converted.omitted {
        *omitted = true;
        return Ok(None);
    }
    let minor = converted
        .converted
        .map(|money| money.minor_units())
        .unwrap_or(0);
    i32::try_from(minor).map(Some).map_err(|_| {
        crate::Error::CalculationOverflow("converted projection exceeds i32".to_string())
    })
}

fn seed_previous_for_current(budget: &Budget) -> Result<BudgetPeriod> {
    if !budget.current_period.complete {
        return Ok(BudgetPeriod {
            start: budget.current_period.start,
            end: budget.current_period.start,
            base_allowance: budget.current_period.base_allowance,
            effective_allowance: None,
            net_budget_spending: budget.current_period.net_budget_spending,
            remaining_allowance: None,
            status: None,
            complete: false,
            currency: budget.current_period.currency.clone(),
        });
    }
    // Reconstruct the predecessor carry implied by the durable current period.
    // effective = base + carry → carry = effective - base
    let carry = budget
        .current_period
        .effective_allowance
        .ok_or_else(|| {
            crate::Error::InvalidData("Complete period missing effective allowance".to_string())
        })?
        .checked_sub(budget.current_period.base_allowance)
        .ok_or_else(|| {
            crate::Error::CalculationOverflow("Budget calculation overflow".to_string())
        })?;
    match budget.rollover_mode {
        BudgetRolloverMode::Off => Ok(BudgetPeriod {
            start: budget.current_period.start,
            end: budget.current_period.start,
            base_allowance: 0,
            effective_allowance: Some(0),
            net_budget_spending: 0,
            remaining_allowance: Some(0),
            status: budget.current_period.status,
            complete: budget.current_period.complete,
            currency: budget.current_period.currency.clone(),
        }),
        BudgetRolloverMode::PreviousPeriodOnly => {
            // previous.base - previous.net = carry
            Ok(BudgetPeriod {
                start: budget.current_period.start,
                end: budget.current_period.start,
                base_allowance: carry,
                effective_allowance: Some(carry),
                net_budget_spending: 0,
                remaining_allowance: Some(carry),
                status: budget.current_period.status,
                complete: budget.current_period.complete,
                currency: budget.current_period.currency.clone(),
            })
        }
        BudgetRolloverMode::Cumulative => Ok(BudgetPeriod {
            start: budget.current_period.start,
            end: budget.current_period.start,
            base_allowance: 0,
            effective_allowance: Some(carry),
            net_budget_spending: 0,
            remaining_allowance: Some(carry),
            status: budget.current_period.status,
            complete: budget.current_period.complete,
            currency: budget.current_period.currency.clone(),
        }),
    }
}

#[cfg(test)]
#[path = "forecast_tests.rs"]
mod tests;
