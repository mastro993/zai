use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

use crate::Error;

const INVALID_COLOR_MESSAGE: &str =
    "Transaction category color must be a valid hex color in the format #RRGGBB";

fn validate_color(color: Option<&str>) -> Result<(), Error> {
    if let Some(color) = color {
        let is_valid_hex = color.len() == 7
            && color.starts_with('#')
            && color.as_bytes()[1..]
                .iter()
                .all(|byte| byte.is_ascii_hexdigit());

        if !is_valid_hex {
            return Err(Error::InvalidData(INVALID_COLOR_MESSAGE.to_string()));
        }
    }

    Ok(())
}

pub(crate) fn normalize_hex_color(color: &str) -> Result<String, Error> {
    validate_color(Some(color))?;
    Ok(color.to_ascii_uppercase())
}

pub(crate) fn normalize_optional_color(color: Option<&str>) -> Result<Option<String>, Error> {
    color.map(normalize_hex_color).transpose()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionCategory {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub parent: Option<Box<Self>>,
}

#[derive(
    Queryable,
    Identifiable,
    Insertable,
    AsChangeset,
    Selectable,
    PartialEq,
    Serialize,
    Deserialize,
    Debug,
    Clone,
)]
#[diesel(table_name = crate::schema::transaction_categories)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
#[diesel(belongs_to(TransactionCategoryRow, foreign_key = parent_id))]
pub struct TransactionCategoryRow {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    #[diesel(skip_insertion)]
    pub created_at: NaiveDateTime,
    #[diesel(skip_insertion)]
    pub updated_at: NaiveDateTime,
    pub deleted_at: Option<NaiveDateTime>,
}

impl From<TransactionCategoryRow> for TransactionCategory {
    fn from(value: TransactionCategoryRow) -> Self {
        Self {
            id: value.id,
            parent_id: value.parent_id,
            name: value.name,
            description: value.description,
            color: value.color,
            parent: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTransactionCategory {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

impl NewTransactionCategory {
    pub fn validate(&self) -> Result<(), Error> {
        if self.name.trim().is_empty() {
            return Err(Error::InvalidData(
                "Transaction category name cannot be empty".to_string(),
            ));
        }
        validate_color(self.color.as_deref())?;
        Ok(())
    }
}

impl From<NewTransactionCategory> for TransactionCategoryRow {
    fn from(value: NewTransactionCategory) -> Self {
        let now = chrono::Utc::now().naive_utc();
        Self {
            id: value.id.unwrap_or_default(),
            parent_id: value.parent_id,
            name: value.name,
            description: value.description,
            color: value.color,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionCategoryUpdate {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

impl TransactionCategoryUpdate {
    pub fn validate(&self) -> Result<(), Error> {
        if self.id.trim().is_empty() {
            return Err(Error::InvalidData(
                "Transaction category id is required for updates".to_string(),
            ));
        }
        if self.name.trim().is_empty() {
            return Err(Error::InvalidData(
                "Transaction category name cannot be empty".to_string(),
            ));
        }
        // Prevent self-reference: a category cannot be its own parent
        if let Some(parent_id) = &self.parent_id {
            if parent_id == &self.id {
                return Err(Error::InvalidData(
                    "A category cannot be its own parent".to_string(),
                ));
            }
        }
        validate_color(self.color.as_deref())?;
        Ok(())
    }
}

impl From<TransactionCategoryUpdate> for TransactionCategoryRow {
    fn from(value: TransactionCategoryUpdate) -> Self {
        let now = chrono::Utc::now().naive_utc();
        Self {
            id: value.id,
            parent_id: value.parent_id,
            name: value.name,
            description: value.description,
            color: value.color,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::features::transaction_categories::transaction_categories_models::*;

    #[tokio::test]
    async fn test_new_transaction_category_validation() {
        let new_category = NewTransactionCategory {
            name: "Test Category".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            id: None,
        };

        new_category.validate().expect("validate");

        assert!(new_category.id.is_none());
        assert_eq!(new_category.name, "Test Category");
        assert_eq!(
            new_category.description.as_deref(),
            Some("Descrizione test")
        );
        assert_eq!(new_category.color.as_deref(), Some("#FF0000"));

        let new_category_invalid = NewTransactionCategory {
            name: "".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            id: None,
        };

        let result = new_category_invalid.validate();

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_new_transaction_category_rejects_invalid_color() {
        let new_category_invalid = NewTransactionCategory {
            name: "Test Category".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("red".to_string()),
            id: None,
        };

        let result = new_category_invalid.validate();

        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains(INVALID_COLOR_MESSAGE)
        );
    }

    #[tokio::test]
    async fn test_transaction_category_update_validation() {
        let new_category = TransactionCategoryUpdate {
            id: "some-id".to_string(),
            name: "Test Category".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
        };

        new_category.validate().expect("validate");

        assert_eq!(new_category.name, "Test Category");
        assert_eq!(
            new_category.description.as_deref(),
            Some("Descrizione test")
        );
        assert_eq!(new_category.color.as_deref(), Some("#FF0000"));

        let new_category_invalid = TransactionCategoryUpdate {
            id: "".to_string(),
            name: "Test".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
        };

        let result = new_category_invalid.validate();

        assert!(result.is_err());

        // Test self-reference validation
        let self_ref = TransactionCategoryUpdate {
            id: "same-id".to_string(),
            name: "Test Category".to_string(),
            parent_id: Some("same-id".to_string()),
            description: None,
            color: None,
        };

        let result = self_ref.validate();
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("cannot be its own parent")
        );

        let invalid_color = TransactionCategoryUpdate {
            id: "some-id".to_string(),
            name: "Test Category".to_string(),
            parent_id: None,
            description: None,
            color: Some("#12345".to_string()),
        };

        let result = invalid_color.validate();
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains(INVALID_COLOR_MESSAGE)
        );
    }

    #[tokio::test]
    async fn test_normalize_optional_color_uppercases_valid_hex() {
        let normalized = normalize_optional_color(Some("#ff0000")).expect("normalize");

        assert_eq!(normalized.as_deref(), Some("#FF0000"));
    }

    #[tokio::test]
    async fn test_normalize_optional_color_keeps_none() {
        let normalized = normalize_optional_color(None).expect("normalize");

        assert!(normalized.is_none());
    }
}
