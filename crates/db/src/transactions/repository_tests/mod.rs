use super::*;
use crate::budgets::BudgetsRepository;
use crate::connection::{get_connection, run_migrations};
use crate::schema::{transaction_categories, transactions};
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use chrono::NaiveDate;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use diesel::{Connection, QueryDsl, RunQueryDsl, sql_query};
use std::sync::Arc;
use uuid::Uuid;
use zai_core::Error;
use zai_core::features::budgets::models::NewBudget;
use zai_core::features::budgets::traits::BudgetsRepositoryTrait;
use zai_core::features::transaction_categories::models::NewTransactionCategory;

fn setup_test_repo(db_path: &str) -> TransactionsRepository {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(db_path);
    let pool = Pool::builder()
        .build(manager)
        .expect("failed to create pool");

    run_migrations(&pool).expect("failed to run migrations");

    let writer = spawn_writer(pool.clone()).expect("failed to spawn writer");
    TransactionsRepository::new(Arc::new(pool), writer)
}

fn parse_datetime(value: &str) -> chrono::NaiveDateTime {
    chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S").expect("valid datetime")
}

fn import_candidate(description: &str, amount: i32, value: &str) -> NewTransaction {
    NewTransaction {
        id: Some(Uuid::new_v4().to_string()),
        description: Some(description.to_string()),
        amount,
        transaction_date: parse_datetime(value),
        transaction_type: "expense".to_string(),
        transaction_category_id: None,
        notes: None,
    }
}

mod import;
mod mutations_and_reads;
