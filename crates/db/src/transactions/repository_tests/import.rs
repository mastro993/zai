use super::*;

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
