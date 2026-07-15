use super::{
    BUDGET_STATUS_PRODUCER_KEY, BudgetAlertMode, BudgetAlertScenario, PeriodAnnouncedStatuses,
    alerts_for_scenario, occurrence_key,
};
use crate::features::budgets::models::{BudgetPeriod, BudgetStatus};
use chrono::NaiveDate;

fn sample_period(status: BudgetStatus) -> BudgetPeriod {
    let start = NaiveDate::from_ymd_opt(2026, 7, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();
    let end = NaiveDate::from_ymd_opt(2026, 8, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();
    BudgetPeriod {
        start,
        end,
        base_allowance: 10_000,
        effective_allowance: 10_000,
        net_budget_spending: match status {
            BudgetStatus::OnTrack => 5_000,
            BudgetStatus::Warning => 8_500,
            BudgetStatus::Overspent => 12_000,
        },
        remaining_allowance: match status {
            BudgetStatus::OnTrack => 5_000,
            BudgetStatus::Warning => 1_500,
            BudgetStatus::Overspent => -2_000,
        },
        status,
    }
}

fn evaluate(
    mode: BudgetAlertMode,
    scenario: BudgetAlertScenario,
    announced: PeriodAnnouncedStatuses,
) -> Vec<BudgetStatus> {
    alerts_for_scenario(
        mode,
        scenario,
        announced,
        "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "Groceries",
        &sample_period(match scenario {
            BudgetAlertScenario::SamePeriodTransition { after, .. } => after,
            BudgetAlertScenario::PeriodAdvancement { final_status } => final_status,
            BudgetAlertScenario::ResumeCurrent { status } => status,
        }),
    )
    .expect("policy evaluation")
    .into_iter()
    .map(|alert| {
        assert_eq!(alert.producer_key, BUDGET_STATUS_PRODUCER_KEY);
        match alert.severity {
            crate::features::domain_alerts::DomainAlertSeverity::Warning => BudgetStatus::Warning,
            crate::features::domain_alerts::DomainAlertSeverity::Critical => {
                BudgetStatus::Overspent
            }
            _ => panic!("unexpected severity"),
        }
    })
    .collect()
}

#[test]
fn silent_mode_never_emits() {
    let announced = PeriodAnnouncedStatuses::default();
    let alerts = evaluate(
        BudgetAlertMode::Silent,
        BudgetAlertScenario::SamePeriodTransition {
            before: BudgetStatus::OnTrack,
            after: BudgetStatus::Overspent,
        },
        announced,
    );
    assert!(alerts.is_empty());
}

#[test]
fn transition_into_warning_requires_fresh_period() {
    let announced = PeriodAnnouncedStatuses::default();
    let alerts = evaluate(
        BudgetAlertMode::Transition,
        BudgetAlertScenario::SamePeriodTransition {
            before: BudgetStatus::OnTrack,
            after: BudgetStatus::Warning,
        },
        announced,
    );
    assert_eq!(alerts, vec![BudgetStatus::Warning]);
}

#[test]
fn transition_into_overspent_emits_critical_only() {
    let announced = PeriodAnnouncedStatuses::default();
    let alerts = evaluate(
        BudgetAlertMode::Transition,
        BudgetAlertScenario::SamePeriodTransition {
            before: BudgetStatus::OnTrack,
            after: BudgetStatus::Overspent,
        },
        announced,
    );
    assert_eq!(alerts, vec![BudgetStatus::Overspent]);
}

#[test]
fn warning_to_overspent_may_retain_both_alerts() {
    let announced = PeriodAnnouncedStatuses {
        warning: true,
        critical: false,
    };
    let alerts = evaluate(
        BudgetAlertMode::Transition,
        BudgetAlertScenario::SamePeriodTransition {
            before: BudgetStatus::Warning,
            after: BudgetStatus::Overspent,
        },
        announced,
    );
    assert_eq!(alerts, vec![BudgetStatus::Overspent]);
}

#[test]
fn reentering_announced_warning_is_silent() {
    let announced = PeriodAnnouncedStatuses {
        warning: true,
        critical: false,
    };
    let alerts = evaluate(
        BudgetAlertMode::Transition,
        BudgetAlertScenario::SamePeriodTransition {
            before: BudgetStatus::OnTrack,
            after: BudgetStatus::Warning,
        },
        announced,
    );
    assert!(alerts.is_empty());
}

#[test]
fn reentering_announced_overspent_is_silent() {
    let announced = PeriodAnnouncedStatuses {
        warning: false,
        critical: true,
    };
    let alerts = evaluate(
        BudgetAlertMode::Transition,
        BudgetAlertScenario::SamePeriodTransition {
            before: BudgetStatus::Warning,
            after: BudgetStatus::Overspent,
        },
        announced,
    );
    assert!(alerts.is_empty());
}

#[test]
fn unchanged_status_is_silent() {
    let announced = PeriodAnnouncedStatuses::default();
    let alerts = evaluate(
        BudgetAlertMode::Transition,
        BudgetAlertScenario::SamePeriodTransition {
            before: BudgetStatus::Warning,
            after: BudgetStatus::Warning,
        },
        announced,
    );
    assert!(alerts.is_empty());
}

#[test]
fn advancement_emits_only_final_period_alert() {
    let announced = PeriodAnnouncedStatuses::default();
    let alerts = evaluate(
        BudgetAlertMode::Transition,
        BudgetAlertScenario::PeriodAdvancement {
            final_status: BudgetStatus::Warning,
        },
        announced,
    );
    assert_eq!(alerts, vec![BudgetStatus::Warning]);
}

#[test]
fn resume_on_track_is_silent() {
    let announced = PeriodAnnouncedStatuses::default();
    let alerts = evaluate(
        BudgetAlertMode::Resume,
        BudgetAlertScenario::ResumeCurrent {
            status: BudgetStatus::OnTrack,
        },
        announced,
    );
    assert!(alerts.is_empty());
}

#[test]
fn resume_warning_respects_announced_suppression() {
    let announced = PeriodAnnouncedStatuses {
        warning: true,
        critical: false,
    };
    let alerts = evaluate(
        BudgetAlertMode::Resume,
        BudgetAlertScenario::ResumeCurrent {
            status: BudgetStatus::Warning,
        },
        announced,
    );
    assert!(alerts.is_empty());
}

#[test]
fn resume_overspent_emits_when_critical_not_announced() {
    let announced = PeriodAnnouncedStatuses::default();
    let alerts = evaluate(
        BudgetAlertMode::Resume,
        BudgetAlertScenario::ResumeCurrent {
            status: BudgetStatus::Overspent,
        },
        announced,
    );
    assert_eq!(alerts, vec![BudgetStatus::Overspent]);
}

#[test]
fn occurrence_key_is_stable_and_versioned() {
    let start = NaiveDate::from_ymd_opt(2026, 7, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();
    let key = occurrence_key(
        "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        start,
        BudgetStatus::Warning,
    );
    assert_eq!(
        key,
        "v1:6ba7b810-9dad-11d1-80b4-00c04fd430c8:2026-07-01T00:00:00:warning"
    );
}
