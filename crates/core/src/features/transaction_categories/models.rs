use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use crate::{BudgetImpact, Error};

const INVALID_HUE_MESSAGE: &str = "Category hue must be an integer from 0 to 360";

fn validate_hue(hue: Option<i32>) -> Result<(), Error> {
    if hue.is_some_and(|value| !(0..=360).contains(&value)) {
        return Err(Error::InvalidData(INVALID_HUE_MESSAGE.to_string()));
    }

    Ok(())
}

pub(crate) fn normalize_hue(hue: Option<i32>) -> Result<Option<i32>, Error> {
    validate_hue(hue)?;
    Ok(hue.map(|value| if value == 360 { 0 } else { value }))
}

pub(crate) fn normalize_category_name(name: &str) -> String {
    name.trim().to_string()
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CategoryRole {
    #[default]
    Spending,
    Income,
}

impl CategoryRole {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Spending => "spending",
            Self::Income => "income",
        }
    }
}

impl fmt::Display for CategoryRole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for CategoryRole {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "spending" => Ok(Self::Spending),
            "income" => Ok(Self::Income),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionCategory {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub hue: Option<i32>,
    pub role: CategoryRole,
    pub parent: Option<Box<Self>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringCategoryImpact {
    pub recurring_transaction_id: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryDeletionPreview {
    pub affected_recurring_transactions: Vec<RecurringCategoryImpact>,
    pub affected_budgets: Vec<BudgetImpact>,
    pub blocked_by_current_budget: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CategoryChildrenDeleteStrategy {
    Block,
    Promote,
    Delete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTransactionCategory {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub hue: Option<i32>,
    pub role: Option<CategoryRole>,
}

impl NewTransactionCategory {
    pub fn validate(&self) -> Result<(), Error> {
        if self.name.trim().is_empty() {
            return Err(Error::InvalidData(
                "Category name cannot be empty".to_string(),
            ));
        }
        validate_hue(self.hue)?;
        validate_category_role(self.parent_id.as_deref(), self.role)?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionCategoryUpdate {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub hue: Option<i32>,
    pub role: Option<CategoryRole>,
    #[serde(default)]
    pub confirm_budget_impact: bool,
}

impl TransactionCategoryUpdate {
    pub fn validate(&self) -> Result<(), Error> {
        if self.id.trim().is_empty() {
            return Err(Error::InvalidData(
                "Category id is required for updates".to_string(),
            ));
        }
        if self.name.trim().is_empty() {
            return Err(Error::InvalidData(
                "Category name cannot be empty".to_string(),
            ));
        }
        if let Some(parent_id) = &self.parent_id
            && parent_id == &self.id
        {
            return Err(Error::InvalidData(
                "A category cannot be its own parent".to_string(),
            ));
        }
        validate_hue(self.hue)?;
        validate_category_role(self.parent_id.as_deref(), self.role)?;
        Ok(())
    }
}

fn validate_category_role(
    parent_id: Option<&str>,
    role: Option<CategoryRole>,
) -> Result<(), Error> {
    let is_child = parent_id.is_some_and(|id| !id.trim().is_empty());

    match (is_child, role) {
        (false, None) => Err(Error::InvalidData(
            "Root categories require a role".to_string(),
        )),
        (true, Some(_)) => Err(Error::InvalidData(
            "Child categories inherit their root category role".to_string(),
        )),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use crate::features::transaction_categories::models::*;

    #[tokio::test]
    async fn test_new_transaction_category_validation() {
        let new_category = NewTransactionCategory {
            name: "Test Category".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            hue: Some(20),
            role: Some(CategoryRole::Spending),
            id: None,
        };

        new_category.validate().expect("validate");

        assert!(new_category.id.is_none());
        assert_eq!(new_category.name, "Test Category");
        assert_eq!(
            new_category.description.as_deref(),
            Some("Descrizione test")
        );
        assert_eq!(new_category.hue, Some(20));

        let new_category_invalid = NewTransactionCategory {
            name: "".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            hue: Some(20),
            role: Some(CategoryRole::Spending),
            id: None,
        };

        let result = new_category_invalid.validate();

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_new_transaction_category_rejects_invalid_hue() {
        let new_category_invalid = NewTransactionCategory {
            name: "Test Category".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            hue: Some(361),
            role: Some(CategoryRole::Spending),
            id: None,
        };

        let result = new_category_invalid.validate();

        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains(INVALID_HUE_MESSAGE)
        );
    }

    #[tokio::test]
    async fn test_transaction_category_update_validation() {
        let new_category = TransactionCategoryUpdate {
            id: "some-id".to_string(),
            name: "Test Category".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            hue: Some(20),
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        };

        new_category.validate().expect("validate");

        assert_eq!(new_category.name, "Test Category");
        assert_eq!(
            new_category.description.as_deref(),
            Some("Descrizione test")
        );
        assert_eq!(new_category.hue, Some(20));

        let new_category_invalid = TransactionCategoryUpdate {
            id: "".to_string(),
            name: "Test".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            hue: Some(20),
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        };

        let result = new_category_invalid.validate();

        assert!(result.is_err());

        // Test self-reference validation
        let self_ref = TransactionCategoryUpdate {
            id: "same-id".to_string(),
            name: "Test Category".to_string(),
            parent_id: Some("same-id".to_string()),
            description: None,
            hue: None,
            role: None,
            confirm_budget_impact: false,
        };

        let result = self_ref.validate();
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("cannot be its own parent")
        );

        let invalid_hue = TransactionCategoryUpdate {
            id: "some-id".to_string(),
            name: "Test Category".to_string(),
            parent_id: None,
            description: None,
            hue: Some(-1),
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        };

        let result = invalid_hue.validate();
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains(INVALID_HUE_MESSAGE)
        );
    }

    #[tokio::test]
    async fn test_normalize_hue_wraps_360() {
        let normalized = normalize_hue(Some(360)).expect("normalize");

        assert_eq!(normalized, Some(0));
    }

    #[tokio::test]
    async fn test_normalize_hue_keeps_none() {
        let normalized = normalize_hue(None).expect("normalize");

        assert!(normalized.is_none());
    }

    #[test]
    fn root_categories_require_a_role() {
        let category = NewTransactionCategory {
            id: None,
            parent_id: None,
            name: "Salary".to_string(),
            description: None,
            hue: None,
            role: None,
        };

        assert!(category.validate().is_err());
    }

    #[test]
    fn child_categories_reject_an_independent_role() {
        let category = NewTransactionCategory {
            id: None,
            parent_id: Some("root".to_string()),
            name: "Groceries".to_string(),
            description: None,
            hue: None,
            role: Some(CategoryRole::Income),
        };

        assert!(category.validate().is_err());
    }

    #[test]
    fn category_roles_use_stable_wire_values() {
        assert_eq!(
            serde_json::to_string(&CategoryRole::Spending).unwrap(),
            "\"spending\""
        );
        assert_eq!(
            serde_json::to_string(&CategoryRole::Income).unwrap(),
            "\"income\""
        );
    }
}
