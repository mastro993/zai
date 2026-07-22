use crate::features::budgets::models::{
    BudgetCadence, BudgetMeasurementMode, BudgetRolloverMode, BudgetStatus,
};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProjectionSourceErrorKind {
    DueCatchUp,
    GenerationBlocked,
    StaleBudgetTimeline,
    MissingRevision,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionSourceError {
    pub kind: ProjectionSourceErrorKind,
    pub recurring_transaction_id: Option<String>,
    pub budget_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectedOccurrenceAttribution {
    pub recurring_transaction_id: String,
    pub schedule_revision_id: String,
    pub ordinal: i32,
    pub scheduled_local: NaiveDateTime,
    pub description: String,
    pub contribution: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetPeriodForecast {
    pub budget_id: String,
    pub budget_name: String,
    pub period_start: NaiveDateTime,
    pub period_end: NaiveDateTime,
    pub cadence: BudgetCadence,
    pub measurement_mode: BudgetMeasurementMode,
    pub rollover_mode: BudgetRolloverMode,
    pub base_allowance: i64,
    pub actual_net_budget_spending: i64,
    pub projected_delta: i64,
    pub forecast_net_budget_spending: i64,
    pub effective_allowance: Option<i64>,
    pub remaining_allowance: Option<i64>,
    pub status: Option<BudgetStatus>,
    pub partial: bool,
    pub covered_until: NaiveDateTime,
    pub attribution: Vec<ProjectedOccurrenceAttribution>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetProjectionQuery {
    pub horizon_months: u32,
    #[serde(default)]
    pub include_paused_budgets: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus_recurring_transaction_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetProjectionResult {
    pub observed_local: NaiveDateTime,
    pub through_local: NaiveDateTime,
    pub horizon_months: u32,
    pub complete: bool,
    pub periods: Vec<BudgetPeriodForecast>,
    pub source_errors: Vec<ProjectionSourceError>,
}

impl BudgetProjectionResult {
    pub fn focused_attribution(mut self, recurring_transaction_id: &str) -> Self {
        for period in &mut self.periods {
            period
                .attribution
                .retain(|item| item.recurring_transaction_id == recurring_transaction_id);
        }
        self
    }
}
