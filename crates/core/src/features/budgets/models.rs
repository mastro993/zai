use crate::query::PaginatedData;
use crate::{Error, Result};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};

pub use super::periods::{current_month_period, current_period};
pub use super::scope::{CategoryHierarchy, canonicalize_category_ids, expand_category_scope};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BudgetMeasurementMode {
    #[default]
    Spending,
    NetCashFlow,
}

impl BudgetMeasurementMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Spending => "spending",
            Self::NetCashFlow => "netCashFlow",
        }
    }
}

impl fmt::Display for BudgetMeasurementMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for BudgetMeasurementMode {
    type Err = ();

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value {
            "spending" => Ok(Self::Spending),
            "netCashFlow" => Ok(Self::NetCashFlow),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BudgetCadence {
    Day,
    Week,
    #[default]
    Month,
    Year,
}

impl BudgetCadence {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Day => "day",
            Self::Week => "week",
            Self::Month => "month",
            Self::Year => "year",
        }
    }
}

impl fmt::Display for BudgetCadence {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for BudgetCadence {
    type Err = ();

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value {
            "day" => Ok(Self::Day),
            "week" => Ok(Self::Week),
            "month" => Ok(Self::Month),
            "year" => Ok(Self::Year),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BudgetRolloverMode {
    #[default]
    Off,
    PreviousPeriodOnly,
    Cumulative,
}

impl BudgetRolloverMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::PreviousPeriodOnly => "previousPeriodOnly",
            Self::Cumulative => "cumulative",
        }
    }
}

impl fmt::Display for BudgetRolloverMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for BudgetRolloverMode {
    type Err = ();

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value {
            "off" => Ok(Self::Off),
            "previousPeriodOnly" => Ok(Self::PreviousPeriodOnly),
            "cumulative" => Ok(Self::Cumulative),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BudgetStatus {
    OnTrack,
    Warning,
    Overspent,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BudgetListFilter {
    #[default]
    Active,
    Paused,
    All,
}

impl BudgetListFilter {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Paused => "paused",
            Self::All => "all",
        }
    }
}

impl fmt::Display for BudgetListFilter {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for BudgetListFilter {
    type Err = ();

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value {
            "active" => Ok(Self::Active),
            "paused" => Ok(Self::Paused),
            "all" => Ok(Self::All),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetPeriod {
    pub start: NaiveDateTime,
    pub end: NaiveDateTime,
    pub base_allowance: i64,
    pub effective_allowance: i64,
    pub net_budget_spending: i64,
    pub remaining_allowance: i64,
    pub status: BudgetStatus,
}

pub type BudgetPeriodHistory = PaginatedData<BudgetPeriod>;

pub fn validate_history_paging(page: i64, per_page: i64) -> Result<()> {
    if page < 1 || !(1..=100).contains(&per_page) {
        return Err(Error::InvalidData(
            "Budget history page must be at least 1 and page size must be between 1 and 100"
                .to_string(),
        ));
    }
    page.checked_sub(1)
        .and_then(|value| value.checked_mul(per_page))
        .ok_or_else(|| Error::InvalidData("Budget history page is too large".to_string()))?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
    pub id: String,
    pub name: String,
    pub revision: i64,
    pub paused: bool,
    pub category_ids: Vec<String>,
    pub cadence: BudgetCadence,
    pub measurement_mode: BudgetMeasurementMode,
    pub base_allowance: i64,
    pub rollover_mode: BudgetRolloverMode,
    pub warning_percentage: Option<i32>,
    pub current_period: BudgetPeriod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewBudget {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub name: String,
    pub base_allowance: i64,
    #[serde(default)]
    pub cadence: Option<BudgetCadence>,
    #[serde(default)]
    pub category_ids: Vec<String>,
    #[serde(default)]
    pub measurement_mode: Option<BudgetMeasurementMode>,
    #[serde(default)]
    pub rollover_mode: Option<BudgetRolloverMode>,
    #[serde(default)]
    pub warning_percentage: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetUpdate {
    pub expected_revision: i64,
    pub name: String,
    pub base_allowance: i64,
    pub cadence: BudgetCadence,
    pub category_ids: Vec<String>,
    pub measurement_mode: BudgetMeasurementMode,
    pub rollover_mode: BudgetRolloverMode,
    pub warning_percentage: Option<i32>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetLifecycleUpdate {
    pub expected_revision: i64,
}

impl BudgetLifecycleUpdate {
    pub fn validate(&self) -> Result<()> {
        if self.expected_revision < 0 {
            return Err(Error::InvalidData(
                "Budget expected revision cannot be negative".to_string(),
            ));
        }
        Ok(())
    }
}

impl NewBudget {
    pub fn validate(&self) -> Result<()> {
        if self.name.trim().is_empty() {
            return Err(Error::InvalidData(
                "Budget name cannot be empty".to_string(),
            ));
        }
        if self.base_allowance < 0 {
            return Err(Error::InvalidData(
                "Budget allowance cannot be negative".to_string(),
            ));
        }
        if let Some(percentage) = self.warning_percentage
            && !(1..=100).contains(&percentage)
        {
            return Err(Error::InvalidData(
                "Budget warning percentage must be between 1 and 100".to_string(),
            ));
        }
        Ok(())
    }
}

impl BudgetUpdate {
    pub fn validate(&self) -> Result<()> {
        if self.expected_revision < 0 {
            return Err(Error::InvalidData(
                "Budget expected revision cannot be negative".to_string(),
            ));
        }
        if self.name.trim().is_empty() {
            return Err(Error::InvalidData(
                "Budget name cannot be empty".to_string(),
            ));
        }
        if self.base_allowance < 0 {
            return Err(Error::InvalidData(
                "Budget allowance cannot be negative".to_string(),
            ));
        }
        if let Some(percentage) = self.warning_percentage
            && !(1..=100).contains(&percentage)
        {
            return Err(Error::InvalidData(
                "Budget warning percentage must be between 1 and 100".to_string(),
            ));
        }
        Ok(())
    }
}

pub(crate) fn normalize_budget_name(name: &str) -> String {
    name.trim().to_string()
}

pub fn calculate_period(
    start: NaiveDateTime,
    end: NaiveDateTime,
    base_allowance: i64,
    net_budget_spending: i64,
    warning_percentage: Option<i32>,
) -> Result<BudgetPeriod> {
    calculate_period_with_rollover(
        start,
        end,
        base_allowance,
        net_budget_spending,
        BudgetRolloverMode::Off,
        None,
        warning_percentage,
    )
}

pub fn calculate_period_with_rollover(
    start: NaiveDateTime,
    end: NaiveDateTime,
    base_allowance: i64,
    net_budget_spending: i64,
    rollover_mode: BudgetRolloverMode,
    previous_period: Option<&BudgetPeriod>,
    warning_percentage: Option<i32>,
) -> Result<BudgetPeriod> {
    let carry = match (rollover_mode, previous_period) {
        (_, None) | (BudgetRolloverMode::Off, _) => 0,
        (BudgetRolloverMode::PreviousPeriodOnly, Some(previous)) => previous
            .base_allowance
            .checked_sub(previous.net_budget_spending)
            .ok_or_else(|| Error::InvalidData("Budget calculation overflow".to_string()))?,
        (BudgetRolloverMode::Cumulative, Some(previous)) => previous.remaining_allowance,
    };
    let effective_allowance = base_allowance
        .checked_add(carry)
        .ok_or_else(|| Error::InvalidData("Budget calculation overflow".to_string()))?;
    let remaining_allowance = effective_allowance
        .checked_sub(net_budget_spending)
        .ok_or_else(|| Error::InvalidData("Budget calculation overflow".to_string()))?;
    let status = if net_budget_spending > effective_allowance {
        BudgetStatus::Overspent
    } else if let Some(percentage) = warning_percentage
        && effective_allowance > 0
    {
        let threshold = effective_allowance
            .checked_mul(i64::from(percentage))
            .and_then(|value| value.checked_add(99))
            .map(|value| value / 100)
            .ok_or_else(|| Error::InvalidData("Budget calculation overflow".to_string()))?;
        if net_budget_spending >= threshold {
            BudgetStatus::Warning
        } else {
            BudgetStatus::OnTrack
        }
    } else {
        BudgetStatus::OnTrack
    };

    Ok(BudgetPeriod {
        start,
        end,
        base_allowance,
        effective_allowance,
        net_budget_spending,
        remaining_allowance,
        status,
    })
}

#[cfg(test)]
#[path = "models_tests.rs"]
mod tests;
