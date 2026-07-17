use super::bulk_ops::{
    export_transactions_csv, find_existing_duplicate_keys, get_filtered_transaction_ids,
};
use super::import_dedup;
use crate::connection::{get_connection, run_migrations};
use crate::test_utils::TempDb;
use crate::transaction_categories::TransactionCategoriesRepository;
use crate::transactions::TransactionsRepository;
use crate::write_actor::spawn_writer;
use chrono::{NaiveDate, NaiveDateTime};
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use uuid::Uuid;
use zai_core::features::transaction_categories::models::NewTransactionCategory;
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;
use zai_core::features::transactions::models::{
    DuplicateKeyCandidate, NewTransaction, TransactionSearchFilters,
};
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;

fn setup_repos(
    temp_db: &TempDb,
) -> (
    TransactionsRepository,
    TransactionCategoriesRepository,
    Arc<diesel::r2d2::Pool<r2d2::ConnectionManager<SqliteConnection>>>,
) {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.clone()).expect("writer");
    let pool = Arc::new(pool);
    let transactions = TransactionsRepository::new(Arc::clone(&pool), writer.clone());
    let categories = TransactionCategoriesRepository::new(Arc::clone(&pool), writer);
    (transactions, categories, pool)
}

fn parse_datetime(value: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S").expect("valid datetime")
}

#[tokio::test]
async fn get_filtered_transaction_ids_respects_filters_and_sort() {
    let temp_db = TempDb::new();
    let (transactions, _categories, pool) = setup_repos(&temp_db);
    let conn = &mut get_connection(&pool).expect("connection");

    let early = transactions
        .create_transaction(NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some("Coffee".to_string()),
            amount: 350,
            transaction_date: parse_datetime("2026-01-15T08:30:00"),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("early transaction");
    let late = transactions
        .create_transaction(NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some("Salary".to_string()),
            amount: 250_000,
            transaction_date: parse_datetime("2026-01-01T00:00:00"),
            transaction_type: "income".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("late transaction");

    let filters = TransactionSearchFilters {
        query: Some("Coffee"),
        categories: None,
        transaction_type: None,
        start_date: None,
        end_date: None,
    };

    let early_id = early.id.clone();
    let late_id = late.id.clone();

    let ids = get_filtered_transaction_ids(conn, Some(&filters), None).expect("ids");

    assert_eq!(ids, vec![early_id.clone()]);

    let all_ids = get_filtered_transaction_ids(conn, None, None).expect("all ids");
    assert_eq!(all_ids, vec![early_id, late_id]);
}

#[tokio::test]
async fn export_transactions_csv_matches_frontend_fixture() {
    let temp_db = TempDb::new();
    let (transactions, categories_repo, pool) = setup_repos(&temp_db);
    let conn = &mut get_connection(&pool).expect("connection");

    let root = categories_repo
        .create_category(NewTransactionCategory {
            id: Some("root".to_string()),
            parent_id: None,
            name: "Food".to_string(),
            description: None,
            color: None,
            role: None,
        })
        .await
        .expect("root category");
    let child = categories_repo
        .create_category(NewTransactionCategory {
            id: Some("child".to_string()),
            parent_id: Some(root.id.clone()),
            name: "Groceries".to_string(),
            description: None,
            color: None,
            role: None,
        })
        .await
        .expect("child category");

    transactions
        .create_transaction(NewTransaction {
            id: Some("tx-1".to_string()),
            description: Some("Coffee, \"special\"".to_string()),
            amount: 350,
            transaction_date: parse_datetime("2026-01-15T08:30:00"),
            transaction_type: "expense".to_string(),
            transaction_category_id: Some(child.id),
            notes: Some("Morning\nrun".to_string()),
        })
        .await
        .expect("coffee transaction");
    transactions
        .create_transaction(NewTransaction {
            id: Some("tx-2".to_string()),
            description: Some("Salary".to_string()),
            amount: 250_000,
            transaction_date: parse_datetime("2026-01-01T00:00:00"),
            transaction_type: "income".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("salary transaction");

    let csv = export_transactions_csv(conn, None, None).expect("csv");

    assert_eq!(
        csv,
        [
            "date,amount,type,description,notes,parent_category,category",
            "2026-01-15T08:30:00,3.50,expense,\"Coffee, \"\"special\"\"\",\"Morning\nrun\",Food,Groceries",
            "2026-01-01T00:00:00,2500.00,income,Salary,,,",
        ]
        .join("\n")
    );
}

#[tokio::test]
async fn export_transactions_csv_by_ids_ignores_filters() {
    let temp_db = TempDb::new();
    let (transactions, _categories, pool) = setup_repos(&temp_db);
    let conn = &mut get_connection(&pool).expect("connection");

    let coffee = transactions
        .create_transaction(NewTransaction {
            id: Some("coffee".to_string()),
            description: Some("Coffee".to_string()),
            amount: 350,
            transaction_date: parse_datetime("2026-01-15T08:30:00"),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("coffee");
    transactions
        .create_transaction(NewTransaction {
            id: Some("salary".to_string()),
            description: Some("Salary".to_string()),
            amount: 250_000,
            transaction_date: parse_datetime("2026-01-01T00:00:00"),
            transaction_type: "income".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("salary");

    let filters = TransactionSearchFilters {
        query: Some("Salary"),
        categories: None,
        transaction_type: None,
        start_date: None,
        end_date: None,
    };

    let csv = export_transactions_csv(conn, Some(&filters), Some(std::slice::from_ref(&coffee.id)))
        .expect("csv");

    assert!(csv.contains("Coffee"));
    assert!(!csv.contains("Salary"));
}

#[tokio::test]
async fn find_existing_duplicate_keys_returns_only_existing_matches() {
    let temp_db = TempDb::new();
    let (transactions, _categories, pool) = setup_repos(&temp_db);
    let conn = &mut get_connection(&pool).expect("connection");

    transactions
        .create_transaction(NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some("groceries".to_string()),
            amount: 1250,
            transaction_date: parse_datetime("2026-01-15T23:59:59"),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("existing transaction");

    let keys = find_existing_duplicate_keys(
        conn,
        &[
            DuplicateKeyCandidate {
                transaction_date: parse_datetime("2026-01-15T08:30:00"),
                amount: 1250,
                description: Some(" Groceries ".to_string()),
            },
            DuplicateKeyCandidate {
                transaction_date: parse_datetime("2026-01-16T08:30:00"),
                amount: 900,
                description: Some("Coffee".to_string()),
            },
        ],
    )
    .expect("duplicate keys");

    assert_eq!(keys.len(), 1);
    assert_eq!(keys[0], "2026-01-15\u{0000}1250\u{0000}groceries");
}

#[test]
fn half_open_date_range_from_dates_matches_import_range() {
    let day = NaiveDate::from_ymd_opt(2026, 1, 15).expect("date");
    let late = day
        .and_hms_nano_opt(23, 59, 59, 500_000_000)
        .expect("late timestamp");
    let dates = vec![parse_datetime("2026-01-15T08:30:00"), late];

    let range = import_dedup::half_open_date_range_from_dates(&dates).expect("range");

    assert_eq!(range.start, parse_datetime("2026-01-15T00:00:00"));
    assert_eq!(
        range.end_exclusive,
        Some(parse_datetime("2026-01-16T00:00:00"))
    );
    assert!(range.end_exclusive.is_some_and(|end| late < end));
}
