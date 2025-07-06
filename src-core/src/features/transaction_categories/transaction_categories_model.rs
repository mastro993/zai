use diesel::prelude::*;

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::transaction_categories)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct TransactionCategory {
    pub id: i32,
    pub parent_id: Option<i32>,
    pub name: Option<String>,
    pub color: Option<String>,
    pub description: Option<String>,
    pub created_at: Option<chrono::NaiveDateTime>,
    pub updated_at: Option<chrono::NaiveDateTime>,
    pub deleted_at: Option<chrono::NaiveDateTime>,
}
