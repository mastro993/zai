use crate::Error;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

pub const BUDGET_CADENCES: &[&str] = &["daily", "weekly", "monthly", "yearly"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BudgetCadence {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

impl BudgetCadence {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Daily => "daily",
            Self::Weekly => "weekly",
            Self::Monthly => "monthly",
            Self::Yearly => "yearly",
        }
    }

    pub fn parse(value: &str) -> Result<Self, Error> {
        match value.trim() {
            "daily" => Ok(Self::Daily),
            "weekly" => Ok(Self::Weekly),
            "monthly" => Ok(Self::Monthly),
            "yearly" => Ok(Self::Yearly),
            other => Err(Error::InvalidData(format!("Invalid budget cadence: {other}"))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BudgetStatus {
    Active,
    Deactivated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetScopeTarget {
    pub category_id: String,
    pub category_name: String,
    pub is_root: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetScope {
    pub targets: Vec<BudgetScopeTarget>,
    pub effective_category_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetPeriod {
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub allowance: i32,
    pub carried_balance: i32,
    pub activity: i32,
    pub available: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
    pub id: String,
    pub name: String,
    pub cadence: BudgetCadence,
    pub status: BudgetStatus,
    pub first_period_start: NaiveDate,
    pub scope: BudgetScope,
    pub current_period: Option<BudgetPeriod>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewBudget {
    pub name: String,
    pub allowance: i32,
    pub cadence: BudgetCadence,
    pub category_ids: Vec<String>,
}

impl NewBudget {
    pub fn validate(&self) -> Result<(), Error> {
        if self.name.trim().is_empty() {
            return Err(Error::InvalidData("Budget name is required".to_string()));
        }

        if self.allowance < 0 {
            return Err(Error::InvalidData(
                "Budget allowance must be zero or greater".to_string(),
            ));
        }

        if self.category_ids.is_empty() {
            return Err(Error::InvalidData(
                "Select at least one category for the budget scope".to_string(),
            ));
        }

        let mut unique_ids = self.category_ids.iter().collect::<Vec<_>>();
        unique_ids.sort();
        unique_ids.dedup();
        if unique_ids.len() != self.category_ids.len() {
            return Err(Error::InvalidData(
                "Budget scope cannot include duplicate categories".to_string(),
            ));
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BudgetListStatus {
    Active,
    Deactivated,
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredBudgetRevision {
    pub id: String,
    pub budget_id: String,
    pub effective_period_start: NaiveDate,
    pub allowance: i32,
    pub category_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredBudget {
    pub id: String,
    pub name: String,
    pub cadence: BudgetCadence,
    pub first_period_start: NaiveDate,
    pub deactivated_at: Option<chrono::NaiveDateTime>,
    pub revisions: Vec<StoredBudgetRevision>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_budget_validation_rejects_blank_name() {
        let budget = NewBudget {
            name: "   ".to_string(),
            allowance: 1000,
            cadence: BudgetCadence::Monthly,
            category_ids: vec!["cat-1".to_string()],
        };

        assert!(budget.validate().is_err());
    }

    #[test]
    fn new_budget_validation_accepts_zero_allowance() {
        let budget = NewBudget {
            name: "No spend".to_string(),
            allowance: 0,
            cadence: BudgetCadence::Monthly,
            category_ids: vec!["cat-1".to_string()],
        };

        budget.validate().expect("zero allowance should be valid");
    }

    #[test]
    fn new_budget_validation_rejects_empty_scope() {
        let budget = NewBudget {
            name: "Food".to_string(),
            allowance: 1000,
            cadence: BudgetCadence::Monthly,
            category_ids: vec![],
        };

        assert!(budget.validate().is_err());
    }
}
