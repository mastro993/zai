use crate::{Error, Result};
use chrono::{Datelike, Months, NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BudgetCadence {
    Month,
}

impl BudgetCadence {
    pub const fn as_str(self) -> &'static str {
        "month"
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
            "month" => Ok(Self::Month),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BudgetRolloverMode {
    Off,
}

impl BudgetRolloverMode {
    pub const fn as_str(self) -> &'static str {
        "off"
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
    pub id: String,
    pub name: String,
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
    pub measurement_mode: Option<BudgetMeasurementMode>,
    #[serde(default)]
    pub warning_percentage: Option<i32>,
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

pub(crate) fn normalize_budget_name(name: &str) -> String {
    name.trim().to_string()
}

pub fn current_month_period(now: NaiveDateTime) -> Result<(NaiveDateTime, NaiveDateTime)> {
    let start_date = NaiveDate::from_ymd_opt(now.year(), now.month(), 1)
        .ok_or_else(|| Error::InvalidData("Invalid current calendar month".to_string()))?;
    let next_month = start_date
        .checked_add_months(Months::new(1))
        .ok_or_else(|| Error::InvalidData("Calendar month is out of range".to_string()))?;
    let start = start_date
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| Error::InvalidData("Invalid month start".to_string()))?;
    let end = next_month
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| Error::InvalidData("Invalid month end".to_string()))?;
    Ok((start, end))
}

pub fn calculate_period(
    start: NaiveDateTime,
    end: NaiveDateTime,
    base_allowance: i64,
    net_budget_spending: i64,
    warning_percentage: Option<i32>,
) -> Result<BudgetPeriod> {
    let remaining_allowance = base_allowance
        .checked_sub(net_budget_spending)
        .ok_or_else(|| Error::InvalidData("Budget calculation overflow".to_string()))?;
    let status = if net_budget_spending > base_allowance {
        BudgetStatus::Overspent
    } else if let Some(percentage) = warning_percentage {
        let threshold = base_allowance
            .checked_mul(i64::from(percentage))
            .and_then(|value| value.checked_add(99))
            .map(|value| value / 100)
            .ok_or_else(|| Error::InvalidData("Budget calculation overflow".to_string()))?;
        if base_allowance > 0 && net_budget_spending >= threshold {
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
        effective_allowance: base_allowance,
        net_budget_spending,
        remaining_allowance,
        status,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

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
            measurement_mode: None,
            warning_percentage: None,
        };

        budget.validate().expect("budget should validate");
        assert_eq!(normalize_budget_name(&budget.name), "July spending");
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
}
