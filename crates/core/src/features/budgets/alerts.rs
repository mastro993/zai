use crate::Result;
use crate::features::budgets::models::{BudgetPeriod, BudgetStatus};
use crate::features::domain_alerts::{
    DomainAlertDestination, DomainAlertRichData, DomainAlertSeverity, NewDomainAlert,
};
use chrono::NaiveDateTime;
use serde_json::{Map, Value, json};

pub const BUDGET_STATUS_PRODUCER_KEY: &str = "budget.status";
pub const BUDGET_STATUS_RICH_KIND: &str = "budget.status";
pub const BUDGET_STATUS_RICH_VERSION: u32 = 1;
pub const BUDGET_STATUS_CURRENCY: &str = "EUR";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BudgetAlertMode {
    Silent,
    Transition,
    Resume,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct PeriodAnnouncedStatuses {
    pub warning: bool,
    pub critical: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BudgetAlertScenario {
    SamePeriodTransition {
        before: BudgetStatus,
        after: BudgetStatus,
    },
    PeriodAdvancement {
        final_status: BudgetStatus,
    },
    ResumeCurrent {
        status: BudgetStatus,
    },
}

pub fn format_period_start_key(period_start: NaiveDateTime) -> String {
    period_start.format("%Y-%m-%dT%H:%M:%S").to_string()
}

pub fn format_period_start_date(period_start: NaiveDateTime) -> String {
    period_start.format("%Y-%m-%d").to_string()
}

pub fn occurrence_key(
    budget_id: &str,
    period_start: NaiveDateTime,
    status: BudgetStatus,
) -> String {
    let status_label = match status {
        BudgetStatus::Warning => "warning",
        BudgetStatus::Overspent => "overspent",
        BudgetStatus::OnTrack => "onTrack",
    };
    format!(
        "v1:{budget_id}:{}:{status_label}",
        format_period_start_key(period_start)
    )
}

pub fn status_from_occurrence_suffix(suffix: &str) -> Option<BudgetStatus> {
    match suffix {
        "warning" => Some(BudgetStatus::Warning),
        "overspent" => Some(BudgetStatus::Overspent),
        _ => None,
    }
}

pub fn alerts_for_scenario(
    mode: BudgetAlertMode,
    scenario: BudgetAlertScenario,
    announced: PeriodAnnouncedStatuses,
    budget_id: &str,
    budget_name: &str,
    period: &BudgetPeriod,
) -> Result<Vec<NewDomainAlert>> {
    if mode == BudgetAlertMode::Silent {
        return Ok(Vec::new());
    }

    let target_status = match (mode, scenario) {
        (BudgetAlertMode::Resume, BudgetAlertScenario::ResumeCurrent { status }) => {
            resume_target_status(status, announced)
        }
        (BudgetAlertMode::Transition, BudgetAlertScenario::PeriodAdvancement { final_status }) => {
            advancement_target_status(final_status, announced)
        }
        (
            BudgetAlertMode::Transition,
            BudgetAlertScenario::SamePeriodTransition { before, after },
        ) => transition_target_status(before, after, announced),
        _ => None,
    };

    target_status
        .map(|status| build_status_alert(budget_id, budget_name, period, status))
        .transpose()
        .map(|alert| alert.into_iter().collect())
}

fn transition_target_status(
    before: BudgetStatus,
    after: BudgetStatus,
    announced: PeriodAnnouncedStatuses,
) -> Option<BudgetStatus> {
    if before == after {
        return None;
    }
    match after {
        BudgetStatus::Warning if !announced.warning && !announced.critical => {
            Some(BudgetStatus::Warning)
        }
        BudgetStatus::Overspent if !announced.critical => Some(BudgetStatus::Overspent),
        _ => None,
    }
}

fn advancement_target_status(
    final_status: BudgetStatus,
    announced: PeriodAnnouncedStatuses,
) -> Option<BudgetStatus> {
    match final_status {
        BudgetStatus::OnTrack => None,
        BudgetStatus::Warning if !announced.warning && !announced.critical => {
            Some(BudgetStatus::Warning)
        }
        BudgetStatus::Overspent if !announced.critical => Some(BudgetStatus::Overspent),
        _ => None,
    }
}

fn resume_target_status(
    status: BudgetStatus,
    announced: PeriodAnnouncedStatuses,
) -> Option<BudgetStatus> {
    match status {
        BudgetStatus::OnTrack => None,
        BudgetStatus::Warning if !announced.warning && !announced.critical => {
            Some(BudgetStatus::Warning)
        }
        BudgetStatus::Overspent if !announced.critical => Some(BudgetStatus::Overspent),
        _ => None,
    }
}

pub fn build_status_alert(
    budget_id: &str,
    budget_name: &str,
    period: &BudgetPeriod,
    status: BudgetStatus,
) -> Result<NewDomainAlert> {
    let period_date = format_period_start_date(period.start);
    let (severity, title, body) = match status {
        BudgetStatus::Warning => (
            DomainAlertSeverity::Warning,
            format!("{budget_name} reached its warning threshold"),
            format!(
                "Net budget spending reached the configured warning threshold for the budget period starting {period_date}."
            ),
        ),
        BudgetStatus::Overspent => (
            DomainAlertSeverity::Critical,
            format!("{budget_name} is overspent"),
            format!(
                "Net budget spending exceeded the effective allowance for the budget period starting {period_date}."
            ),
        ),
        BudgetStatus::OnTrack => {
            return Err(crate::Error::InvalidData(
                "On track budgets do not produce status alerts".to_string(),
            ));
        }
    };

    Ok(NewDomainAlert {
        id: None,
        producer_key: BUDGET_STATUS_PRODUCER_KEY.to_string(),
        occurrence_key: occurrence_key(budget_id, period.start, status),
        severity,
        title,
        body,
        destination: Some(DomainAlertDestination::Budget {
            budget_id: budget_id.to_string(),
        }),
        data: Some(build_rich_data(period, status)),
    })
}

fn build_rich_data(period: &BudgetPeriod, status: BudgetStatus) -> DomainAlertRichData {
    let status_value = match status {
        BudgetStatus::OnTrack => "onTrack",
        BudgetStatus::Warning => "warning",
        BudgetStatus::Overspent => "overspent",
    };
    let payload: Map<String, Value> = Map::from_iter([
        ("status".to_string(), json!(status_value)),
        (
            "periodStart".to_string(),
            json!(period.start.format("%Y-%m-%dT%H:%M:%S").to_string()),
        ),
        (
            "periodEnd".to_string(),
            json!(period.end.format("%Y-%m-%dT%H:%M:%S").to_string()),
        ),
        (
            "effectiveAllowance".to_string(),
            json!(period.effective_allowance),
        ),
        (
            "netBudgetSpending".to_string(),
            json!(period.net_budget_spending),
        ),
        (
            "remainingAllowance".to_string(),
            json!(period.remaining_allowance),
        ),
        ("currency".to_string(), json!(BUDGET_STATUS_CURRENCY)),
    ]);

    DomainAlertRichData {
        kind: BUDGET_STATUS_RICH_KIND.to_string(),
        version: BUDGET_STATUS_RICH_VERSION,
        payload,
    }
}

#[cfg(test)]
#[path = "alerts_tests.rs"]
mod tests;
