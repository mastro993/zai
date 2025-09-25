use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use super::transaction_categories_errors::TransactionCategoryError;

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
#[serde(rename_all = "camelCase")]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct TransactionCategory {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
    pub deleted_at: Option<NaiveDateTime>,
}

#[derive(Insertable, Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
#[diesel(table_name = crate::schema::transaction_categories)]
pub struct NewTransactionCategory {
    pub id: Option<String>,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

impl NewTransactionCategory {
    pub fn validate(&self) -> Result<(), TransactionCategoryError> {
        if self.name.trim().is_empty() {
            return Err(TransactionCategoryError::InvalidData(
                "Name cannot be empty".to_string(),
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::repositories::transaction_categories::NewTransactionCategory;

    #[tokio::test]
    async fn test_validation() {

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
        assert_eq!(new_category.description.as_deref(), Some("Descrizione test"));
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

}