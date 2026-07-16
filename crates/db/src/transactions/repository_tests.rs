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

#[tokio::test]
async fn concurrent_identical_imports_commit_one_logical_row() {
    let temp_db = TempDb::new();
    let repo = Arc::new(setup_test_repo(temp_db.path()));

    let (left, right) = tokio::join!(
        repo.import_transactions(vec![import_candidate(
            " Groceries ",
            1250,
            "2026-01-15T08:30:00"
        )]),
        repo.import_transactions(vec![import_candidate(
            "groceries",
            1250,
            "2026-01-15T20:45:00"
        )]),
    );

    let mut imported = left.expect("first import");
    imported.extend(right.expect("second import"));
    assert_eq!(imported.len(), 1);

    let persisted = repo
        .get_transactions(1, 10, None, None)
        .await
        .expect("list transactions");
    assert_eq!(persisted.data.len(), 1);
}

#[tokio::test]
async fn import_skips_existing_transaction_in_fractional_last_second() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let day = NaiveDate::from_ymd_opt(2026, 1, 15).expect("date");
    let late = day
        .and_hms_nano_opt(23, 59, 59, 500_000_000)
        .expect("late timestamp");

    repo.create_transaction(NewTransaction {
        id: Some(Uuid::new_v4().to_string()),
        description: Some("groceries".to_string()),
        amount: 1250,
        transaction_date: late,
        transaction_type: "expense".to_string(),
        transaction_category_id: None,
        notes: None,
    })
    .await
    .expect("create existing transaction");

    let imported = repo
        .import_transactions(vec![import_candidate(
            " Groceries ",
            1250,
            "2026-01-15T08:30:00",
        )])
        .await
        .expect("import duplicate");

    assert!(imported.is_empty());
}

#[tokio::test]
async fn import_skips_duplicates_within_single_payload() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let imported = repo
        .import_transactions(vec![
            import_candidate(" Groceries ", 1250, "2026-01-15T08:30:00"),
            import_candidate("groceries", 1250, "2026-01-15T20:45:00"),
        ])
        .await
        .expect("import batch");

    assert_eq!(imported.len(), 1);
}

#[tokio::test]
async fn import_keeps_distinct_amounts_and_descriptions() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let imported = repo
        .import_transactions(vec![
            import_candidate("Groceries", 1250, "2026-01-15T08:30:00"),
            import_candidate("Rent", 1250, "2026-01-15T08:30:00"),
            import_candidate("Groceries", 1300, "2026-01-15T08:30:00"),
        ])
        .await
        .expect("import distinct rows");

    assert_eq!(imported.len(), 3);
}

#[tokio::test]
async fn manual_create_still_allows_duplicate_logical_rows() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let shared = NewTransaction {
        id: Some(Uuid::new_v4().to_string()),
        description: Some(" Groceries ".to_string()),
        amount: 1250,
        transaction_date: parse_datetime("2026-01-15T08:30:00"),
        transaction_type: "expense".to_string(),
        transaction_category_id: None,
        notes: None,
    };

    repo.create_transaction(shared.clone())
        .await
        .expect("first manual create");
    repo.create_transaction(NewTransaction {
        id: Some(Uuid::new_v4().to_string()),
        ..shared
    })
    .await
    .expect("second manual create");

    let persisted = repo
        .get_transactions(1, 10, None, None)
        .await
        .expect("list transactions");
    assert_eq!(persisted.data.len(), 2);
}

#[tokio::test]
async fn failed_import_budget_repair_rolls_back_inserted_rows() {
    let temp_db = TempDb::new();
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.clone()).expect("writer");
    let pool = Arc::new(pool);
    let budgets = BudgetsRepository::new(Arc::clone(&pool), writer.clone());
    let transactions = TransactionsRepository::new(Arc::clone(&pool), writer);

    budgets
        .create_budget(NewBudget {
            id: Some("import-rollback".to_string()),
            name: "Import rollback".to_string(),
            base_allowance: 10_000,
            cadence: None,
            category_ids: vec![],
            measurement_mode: None,
            rollover_mode: None,
            warning_percentage: Some(80),
        })
        .await
        .expect("budget");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
    sql_query(
        "UPDATE budget_configurations SET category_ids = '[' WHERE budget_id = 'import-rollback'",
    )
    .execute(&mut conn)
    .expect("corrupt configuration");

    let error = transactions
        .import_transactions(vec![import_candidate(
            "Broken import",
            100,
            "2026-07-15T12:00:00",
        )])
        .await
        .expect_err("import repair should fail");
    assert!(matches!(error, Error::Repository(_)));

    let persisted = transactions
        .get_transactions(1, 10, None, None)
        .await
        .expect("list transactions");
    assert!(persisted.data.is_empty());
}

#[tokio::test]
async fn import_transactions_with_categories_rolls_back_when_any_transaction_is_invalid() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    let category_id = Uuid::new_v4().to_string();
    let categories = vec![NewTransactionCategory {
        id: Some(category_id.clone()),
        parent_id: None,
        name: "Food".to_string(),
        description: None,
        color: None,
        role: None,
    }];

    let valid_transaction = NewTransaction {
        id: Some(Uuid::new_v4().to_string()),
        description: Some("Lunch".to_string()),
        amount: 1200,
        transaction_date: chrono::Utc::now().naive_utc(),
        transaction_type: "expense".to_string(),
        transaction_category_id: Some(category_id),
        notes: None,
    };
    let invalid_transaction = NewTransaction {
        id: valid_transaction.id.clone(),
        description: Some("Broken".to_string()),
        amount: 800,
        transaction_date: chrono::Utc::now().naive_utc(),
        transaction_type: "expense".to_string(),
        transaction_category_id: None,
        notes: None,
    };

    let result = repo
        .import_transactions_with_categories(
            categories,
            vec![valid_transaction, invalid_transaction],
        )
        .await;

    assert!(result.is_err());

    let conn = &mut get_connection(&repo.pool).expect("connection");
    let persisted_categories = transaction_categories::table
        .count()
        .get_result::<i64>(conn)
        .expect("count categories");
    assert_eq!(persisted_categories, 0);
}

fn sample_transaction(description: &str) -> NewTransaction {
    NewTransaction {
        id: Some(Uuid::new_v4().to_string()),
        description: Some(description.to_string()),
        amount: 1000,
        transaction_date: chrono::Utc::now().naive_utc(),
        transaction_type: "expense".to_string(),
        transaction_category_id: None,
        notes: None,
    }
}

fn populated_transaction(category_id: Option<String>) -> NewTransaction {
    NewTransaction {
        id: Some(Uuid::new_v4().to_string()),
        description: Some("Lunch".to_string()),
        amount: 1200,
        transaction_date: chrono::Utc::now().naive_utc(),
        transaction_type: "expense".to_string(),
        transaction_category_id: category_id,
        notes: Some("with friends".to_string()),
    }
}

fn update_transaction(
    created: &Transaction,
    description: Option<String>,
    transaction_category_id: Option<String>,
    notes: Option<String>,
) -> TransactionUpdate {
    TransactionUpdate {
        id: created.id.clone(),
        description,
        amount: created.amount,
        transaction_date: created.transaction_date,
        transaction_type: created.transaction_type.clone(),
        transaction_category_id,
        notes,
    }
}

#[tokio::test]
async fn update_transaction_clears_description_in_database() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let created = repo
        .create_transaction(populated_transaction(None))
        .await
        .expect("create transaction");

    let updated = repo
        .update_transaction(update_transaction(
            &created,
            None,
            None,
            Some("with friends".to_string()),
        ))
        .await
        .expect("update transaction");

    assert_eq!(updated.description, None);
    assert_eq!(
        repo.get_transaction(&created.id).await.unwrap().description,
        None
    );
}

#[tokio::test]
async fn update_transaction_clears_notes_in_database() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let created = repo
        .create_transaction(populated_transaction(None))
        .await
        .expect("create transaction");

    let updated = repo
        .update_transaction(update_transaction(
            &created,
            Some("Lunch".to_string()),
            None,
            None,
        ))
        .await
        .expect("update transaction");

    assert_eq!(updated.notes, None);
    assert_eq!(repo.get_transaction(&created.id).await.unwrap().notes, None);
}

#[tokio::test]
async fn update_transaction_clears_category_in_database() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let category_id = Uuid::new_v4().to_string();
    let created = repo
        .create_transaction(populated_transaction(Some(category_id.clone())))
        .await
        .expect("create transaction");

    let updated = repo
        .update_transaction(update_transaction(
            &created,
            Some("Lunch".to_string()),
            None,
            Some("with friends".to_string()),
        ))
        .await
        .expect("update transaction");

    assert_eq!(updated.transaction_category_id, None);
    assert_eq!(
        repo.get_transaction(&created.id)
            .await
            .unwrap()
            .transaction_category_id,
        None
    );
}

#[tokio::test]
async fn update_transaction_clears_all_nullable_fields_in_database() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let category_id = Uuid::new_v4().to_string();
    let created = repo
        .create_transaction(populated_transaction(Some(category_id)))
        .await
        .expect("create transaction");

    let updated = repo
        .update_transaction(update_transaction(&created, None, None, None))
        .await
        .expect("update transaction");

    assert_eq!(updated.description, None);
    assert_eq!(updated.transaction_category_id, None);
    assert_eq!(updated.notes, None);

    let reread = repo.get_transaction(&created.id).await.unwrap();
    assert_eq!(reread.description, None);
    assert_eq!(reread.transaction_category_id, None);
    assert_eq!(reread.notes, None);
}

#[tokio::test]
async fn update_transaction_leaves_deleted_at_null_for_active_rows() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let created = repo
        .create_transaction(populated_transaction(None))
        .await
        .expect("create transaction");

    repo.update_transaction(update_transaction(&created, None, None, None))
        .await
        .expect("update transaction");

    let conn = &mut get_connection(&repo.pool).expect("connection");
    let deleted_at = transactions::table
        .find(&created.id)
        .select(transactions::deleted_at)
        .first::<Option<chrono::NaiveDateTime>>(conn)
        .expect("deleted_at");

    assert!(deleted_at.is_none());
}

#[tokio::test]
async fn search_query_treats_percent_as_literal() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    repo.create_transaction(sample_transaction("50% off sale"))
        .await
        .expect("create percent transaction");
    repo.create_transaction(sample_transaction("Regular lunch"))
        .await
        .expect("create plain transaction");

    let filters = TransactionSearchFilters {
        query: Some("%"),
        categories: None,
        transaction_type: None,
        start_date: None,
        end_date: None,
    };

    let result = repo
        .get_transactions(1, 10, Some(filters), None)
        .await
        .expect("search transactions");

    assert_eq!(result.data.len(), 1);
    assert_eq!(result.data[0].description.as_deref(), Some("50% off sale"));
}

#[derive(Debug, diesel::QueryableByName)]
#[allow(dead_code)]
struct ExplainQueryPlanRow {
    #[diesel(sql_type = diesel::sql_types::Integer)]
    id: i32,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    parent: i32,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    notused: i32,
    #[diesel(sql_type = diesel::sql_types::Text)]
    detail: String,
}

#[tokio::test]
async fn active_transactions_by_date_uses_partial_index() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    repo.create_transaction(sample_transaction("Indexed lunch"))
        .await
        .expect("create transaction");

    let conn = &mut get_connection(&repo.pool).expect("connection");
    let plan = diesel::sql_query(
        "EXPLAIN QUERY PLAN \
         SELECT * FROM transactions \
         WHERE deleted_at IS NULL \
         ORDER BY transaction_date DESC, created_at ASC \
         LIMIT 10",
    )
    .load::<ExplainQueryPlanRow>(conn)
    .expect("explain query plan");

    assert!(
        plan.iter()
            .any(|row| row.detail.contains("transactions_active_date_index")),
        "expected transactions_active_date_index in query plan: {plan:?}"
    );
}

#[tokio::test]
async fn search_query_treats_underscore_as_literal() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());

    repo.create_transaction(sample_transaction("foo_bar purchase"))
        .await
        .expect("create underscore transaction");
    repo.create_transaction(sample_transaction("foobar purchase"))
        .await
        .expect("create plain transaction");

    let filters = TransactionSearchFilters {
        query: Some("_"),
        categories: None,
        transaction_type: None,
        start_date: None,
        end_date: None,
    };

    let result = repo
        .get_transactions(1, 10, Some(filters), None)
        .await
        .expect("search transactions");

    assert_eq!(result.data.len(), 1);
    assert_eq!(
        result.data[0].description.as_deref(),
        Some("foo_bar purchase")
    );
}

#[tokio::test(flavor = "current_thread")]
async fn pooled_transaction_read_does_not_starve_current_thread_runtime() {
    use crate::blocking::run_blocking;
    use std::sync::mpsc;
    use std::thread;

    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let (entered_tx, entered_rx) = mpsc::channel();
    let (resume_tx, resume_rx) = mpsc::channel::<()>();

    let blocker = tokio::spawn(async move {
        run_blocking(move || {
            entered_tx.send(thread::current().id()).expect("entered");
            resume_rx.recv().expect("resume");
            Ok(())
        })
        .await
    });

    let blocker_tid = tokio::task::spawn_blocking(move || entered_rx.recv())
        .await
        .expect("join")
        .expect("entered");
    assert_ne!(blocker_tid, thread::current().id());

    let (tx, rx) = tokio::sync::oneshot::channel();
    tokio::spawn(async move {
        let _ = tx.send(());
    });
    rx.await
        .expect("runtime should progress while blocking work waits");

    let page = repo
        .get_transactions(1, 10, None, None)
        .await
        .expect("pooled read");
    assert!(page.data.is_empty());

    resume_tx.send(()).expect("resume");
    blocker
        .await
        .expect("join")
        .expect("blocking work should complete");
}
