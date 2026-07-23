use super::*;
use crate::features::budgets::models::{
    Budget, BudgetCadence, BudgetMeasurementMode, BudgetPeriod, BudgetRolloverMode, BudgetStatus,
};
use crate::features::recurring_transactions::models::{
    RecurringLifecycle, RecurringOccurrenceHead, RecurringScheduleRevision,
    RecurringTemplateRevision, RecurringTransaction, ScheduleIntervalUnit, ScheduleRule,
};
use crate::features::recurring_transactions::projection::ProjectionSourceErrorKind;
use chrono::{NaiveDate, NaiveDateTime};

fn dt(year: i32, month: u32, day: u32, hour: u32, minute: u32) -> NaiveDateTime {
    NaiveDate::from_ymd_opt(year, month, day)
        .unwrap()
        .and_hms_opt(hour, minute, 0)
        .unwrap()
}

fn budget_input() -> ProjectionBudgetInput {
    ProjectionBudgetInput {
        budget: Budget {
            id: "budget".to_string(),
            name: "Budget".to_string(),
            revision: 1,
            paused: false,
            category_ids: Vec::new(),
            cadence: BudgetCadence::Month,
            measurement_mode: BudgetMeasurementMode::Spending,
            base_allowance: 10_000,
            rollover_mode: BudgetRolloverMode::Off,
            warning_percentage: None,
            current_period: BudgetPeriod {
                start: dt(2026, 1, 1, 0, 0),
                end: dt(2026, 2, 1, 0, 0),
                base_allowance: 10_000,
                effective_allowance: 10_000,
                net_budget_spending: 0,
                remaining_allowance: 10_000,
                status: BudgetStatus::OnTrack,
            },
        },
        scope_category_ids: Vec::new(),
        warning_percentage: None,
        stale: false,
    }
}

fn template(
    source_id: &str,
    id: &str,
    effective_from: NaiveDateTime,
    effective_until: Option<NaiveDateTime>,
    description: &str,
) -> RecurringTemplateRevision {
    RecurringTemplateRevision {
        id: id.to_string(),
        recurring_transaction_id: source_id.to_string(),
        sequence: 1,
        effective_from_local: effective_from,
        effective_until_local: effective_until,
        description: description.to_string(),
        amount: 100,
        transaction_type: "expense".to_string(),
        transaction_category_id: None,
        notes: None,
    }
}

fn source(
    id: &str,
    first_scheduled_local: NaiveDateTime,
    next_ordinal: i32,
    next_scheduled_local: NaiveDateTime,
    rule: ScheduleRule,
) -> ProjectionSourceInput {
    ProjectionSourceInput {
        recurring: RecurringTransaction {
            id: id.to_string(),
            lifecycle: RecurringLifecycle::Active,
            total_occurrences: None,
            fulfilled_count: 0,
            revision: 1,
            lifecycle_changed_at: first_scheduled_local,
            paused_at: None,
            created_at: first_scheduled_local,
            updated_at: first_scheduled_local,
            deleted_at: None,
        },
        head: RecurringOccurrenceHead {
            recurring_transaction_id: id.to_string(),
            schedule_revision_id: format!("{id}-schedule"),
            next_ordinal,
            next_scheduled_local,
        },
        open_schedule: RecurringScheduleRevision {
            id: format!("{id}-schedule"),
            recurring_transaction_id: id.to_string(),
            sequence: 1,
            effective_from_local: first_scheduled_local,
            effective_until_local: None,
            first_scheduled_local,
            rule,
        },
        unresolved_failure: None,
        templates_by_local: vec![(
            first_scheduled_local,
            template(
                id,
                &format!("{id}-template"),
                first_scheduled_local,
                None,
                "Default",
            ),
        )],
    }
}

fn project(sources: Vec<ProjectionSourceInput>) -> BudgetProjectionResult {
    compute_budget_projection(ProjectionComputeInput {
        observed_local: dt(2026, 1, 5, 12, 0),
        horizon_months: 2,
        budgets: vec![budget_input()],
        sources,
        category_roles: Default::default(),
        category_hierarchy: Vec::new(),
        actual_spending: Default::default(),
        focus_recurring_transaction_id: None,
    })
    .unwrap()
}

#[test]
fn template_transition_uses_half_open_effective_ranges() {
    let first = dt(2026, 1, 15, 9, 0);
    let boundary = dt(2026, 2, 15, 9, 0);
    let mut recurring = source(
        "transition",
        first,
        1,
        first,
        ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Month,
        },
    );
    recurring.templates_by_local = vec![
        (
            first,
            template("transition", "old-template", first, Some(boundary), "Old"),
        ),
        (
            boundary,
            template("transition", "new-template", boundary, None, "New"),
        ),
    ];

    let result = project(vec![recurring]);
    assert!(result.complete);
    let attribution: Vec<_> = result
        .periods
        .iter()
        .flat_map(|period| period.attribution.iter())
        .collect();
    assert_eq!(
        attribution
            .iter()
            .map(|item| item.description.as_str())
            .collect::<Vec<_>>(),
        ["Old", "New"]
    );
}

#[test]
fn missing_and_non_covering_revisions_fail_closed() {
    let first = dt(2026, 1, 15, 9, 0);
    for templates in [
        Vec::new(),
        vec![(
            dt(2026, 1, 1, 0, 0),
            template(
                "invalid",
                "ended-template",
                dt(2026, 1, 1, 0, 0),
                Some(first),
                "Ended",
            ),
        )],
    ] {
        let mut recurring = source(
            "invalid",
            first,
            1,
            first,
            ScheduleRule::Interval {
                every: 1,
                unit: ScheduleIntervalUnit::Month,
            },
        );
        recurring.templates_by_local = templates;
        let result = project(vec![recurring]);
        assert!(!result.complete);
        assert!(result.periods.iter().all(|period| {
            period.projected_delta == 0 && period.attribution.is_empty() && period.status.is_none()
        }));
        assert_eq!(result.source_errors.len(), 1);
        assert_eq!(
            result.source_errors[0].kind,
            ProjectionSourceErrorKind::MissingRevision
        );
        assert_eq!(
            result.source_errors[0].recurring_transaction_id.as_deref(),
            Some("invalid")
        );
    }
}

#[test]
fn malformed_revision_fails_closed() {
    let first = dt(2026, 1, 15, 9, 0);
    let mut recurring = source(
        "malformed",
        first,
        1,
        first,
        ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Month,
        },
    );
    recurring.templates_by_local[0].1.transaction_type = "unknown".to_string();

    let result = project(vec![recurring]);
    assert!(!result.complete);
    assert_eq!(
        result.source_errors[0].kind,
        ProjectionSourceErrorKind::MissingRevision
    );
    assert!(result.periods.iter().all(|period| period.status.is_none()));
}

#[test]
fn invalid_source_does_not_hide_valid_source_contributions() {
    let first = dt(2026, 1, 15, 9, 0);
    let mut invalid = source(
        "invalid",
        first,
        1,
        first,
        ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Month,
        },
    );
    invalid.templates_by_local.clear();
    let valid = source(
        "valid",
        dt(2026, 1, 16, 9, 0),
        1,
        dt(2026, 1, 16, 9, 0),
        ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Month,
        },
    );

    let result = project(vec![invalid, valid]);
    assert!(!result.complete);
    let january = result
        .periods
        .iter()
        .find(|period| period.period_start == dt(2026, 1, 1, 0, 0))
        .unwrap();
    assert_eq!(january.projected_delta, 100);
    assert_eq!(january.attribution.len(), 1);
    assert_eq!(january.attribution[0].recurring_transaction_id, "valid");
    assert!(january.status.is_none());
}

#[test]
fn projection_resolves_all_supported_schedule_units() {
    let cases = [
        (
            ScheduleRule::Interval {
                every: 1,
                unit: ScheduleIntervalUnit::Day,
            },
            dt(2026, 1, 15, 9, 0),
            dt(2026, 1, 16, 9, 0),
        ),
        (
            ScheduleRule::Interval {
                every: 1,
                unit: ScheduleIntervalUnit::Week,
            },
            dt(2026, 1, 15, 9, 0),
            dt(2026, 1, 22, 9, 0),
        ),
        (
            ScheduleRule::Interval {
                every: 1,
                unit: ScheduleIntervalUnit::Month,
            },
            dt(2025, 12, 15, 9, 0),
            dt(2026, 1, 15, 9, 0),
        ),
        (
            ScheduleRule::Interval {
                every: 1,
                unit: ScheduleIntervalUnit::Year,
            },
            dt(2025, 1, 15, 9, 0),
            dt(2026, 1, 15, 9, 0),
        ),
        (
            ScheduleRule::MonthlyDay { day: 31 },
            dt(2025, 12, 31, 9, 0),
            dt(2026, 1, 31, 9, 0),
        ),
    ];

    for (index, (rule, first, next)) in cases.into_iter().enumerate() {
        let result = project(vec![source(
            &format!("source-{index}"),
            first,
            2,
            next,
            rule,
        )]);
        assert!(result.complete, "schedule case {index} incomplete");
        assert!(
            result
                .periods
                .iter()
                .flat_map(|period| period.attribution.iter())
                .any(|item| item.scheduled_local == next),
            "schedule case {index} did not project next occurrence"
        );
    }
}
