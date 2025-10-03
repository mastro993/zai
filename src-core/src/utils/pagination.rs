use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedData<T> {
    pub data: Vec<T>,
    pub page: i32,
    pub page_size: i32,
    pub total_row_count: i64,
}
