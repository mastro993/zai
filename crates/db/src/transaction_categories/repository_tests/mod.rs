use std::sync::Arc;

use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use uuid::Uuid;
use zai_core::Error;
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;

use super::TransactionCategoriesRepository;
use crate::budgets::BudgetsRepository;
use crate::connection::{get_connection, run_migrations};
use crate::schema::transactions;
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetMeasurementMode, BudgetRolloverMode, NewBudget,
};
use zai_core::features::budgets::traits::BudgetsRepositoryTrait;
use zai_core::features::transaction_categories::models::{
    CategoryChildrenDeleteStrategy, CategoryRole, NewTransactionCategory, TransactionCategory,
    TransactionCategoryUpdate,
};
use zai_core::features::transactions::models::NewTransaction;

fn setup_test_repo(db_path: &str) -> TransactionCategoriesRepository {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(db_path);
    let pool = Pool::builder()
        .build(manager)
        .expect("Failed to create pool");

    run_migrations(&pool.clone()).unwrap();

    let writer = spawn_writer(pool.clone()).unwrap();

    TransactionCategoriesRepository::new(Arc::new(pool), writer)
}

fn insert_transaction_with_category(repo: &TransactionCategoriesRepository, category_id: &str) {
    let conn = &mut get_connection(&repo.pool).unwrap();
    let transaction = NewTransaction {
        id: Some(Uuid::new_v4().to_string()),
        description: Some("Lunch".to_string()),
        amount: 1200,
        transaction_date: chrono::Utc::now().naive_utc(),
        transaction_type: "expense".to_string(),
        transaction_category_id: Some(category_id.to_string()),
        notes: None,
    };

    diesel::insert_into(transactions::table)
        .values((
            transactions::id.eq(transaction.id.unwrap()),
            transactions::description.eq(transaction.description),
            transactions::amount.eq(transaction.amount),
            transactions::transaction_date.eq(transaction.transaction_date),
            transactions::transaction_type.eq(transaction.transaction_type),
            transactions::transaction_category_id.eq(transaction.transaction_category_id),
            transactions::notes.eq(transaction.notes),
        ))
        .execute(conn)
        .unwrap();
}

fn new_scoped_budget(category_id: &str) -> NewBudget {
    NewBudget {
        id: Some("budget-1".to_string()),
        name: "Food budget".to_string(),
        base_allowance: 10_000,
        cadence: Some(BudgetCadence::Month),
        category_ids: vec![category_id.to_string()],
        measurement_mode: Some(BudgetMeasurementMode::Spending),
        rollover_mode: Some(BudgetRolloverMode::Off),
        warning_percentage: Some(80),
    }
}

mod bulk_delete;
mod delete;
mod import;
mod metadata;
mod mutations;
mod read;
mod recurring_delete;
