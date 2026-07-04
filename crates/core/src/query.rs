use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedData<T> {
    pub data: Vec<T>,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sort {
    pub field: String,
    pub desc: bool,
}
