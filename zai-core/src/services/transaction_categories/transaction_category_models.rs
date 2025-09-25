use serde::{Deserialize, Serialize};
use zai_db::repositories::transaction_categories::TransactionCategory as TransactionCategoryTable;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionCategory {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

impl From<TransactionCategoryTable> for TransactionCategory {
    fn from(value: TransactionCategoryTable) -> Self {
        Self {
            id: value.id,
            parent_id: value.parent_id,
            name: value.name,
            description: value.description,
            color: value.color,
        }
    }
}
