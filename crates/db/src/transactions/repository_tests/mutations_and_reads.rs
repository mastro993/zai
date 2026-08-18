use super::*;

fn sample_transaction(description: &str) -> NewTransaction {
    NewTransaction {
        id: Some(Uuid::new_v4().to_string()),
        description: Some(description.to_string()),
        amount: 1000,
        currency: "EUR".to_string(),
        transaction_date: chrono::Utc::now().naive_utc(),
        transaction_type: "expense".to_string(),
        transaction_category_id: None,
        notes: None,
        manual_exchange_rate: None,
    }
}

fn populated_transaction(category_id: Option<String>) -> NewTransaction {
    NewTransaction {
        id: Some(Uuid::new_v4().to_string()),
        description: Some("Lunch".to_string()),
        amount: 1200,
        currency: "EUR".to_string(),
        transaction_date: chrono::Utc::now().naive_utc(),
        transaction_type: "expense".to_string(),
        transaction_category_id: category_id,
        notes: Some("with friends".to_string()),
        manual_exchange_rate: None,
    }
}

fn seed_category(repo: &TransactionsRepository, category_id: &str) {
    let conn = &mut get_connection(&repo.pool).expect("connection");
    diesel::insert_into(transaction_categories::table)
        .values((
            transaction_categories::id.eq(category_id),
            transaction_categories::name.eq("Food"),
            transaction_categories::role.eq("spending"),
            transaction_categories::created_at.eq(chrono::Utc::now().naive_utc()),
            transaction_categories::updated_at.eq(chrono::Utc::now().naive_utc()),
        ))
        .execute(conn)
        .expect("seed category");
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
        currency: created.currency.clone(),
        transaction_date: created.transaction_date,
        transaction_type: created.transaction_type.clone(),
        transaction_category_id,
        notes,
        manual_exchange_rate: None,
        confirm_manual_rate_replacement: false,
        retry_rate_lookup: false,
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
    seed_category(&repo, &category_id);
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
    seed_category(&repo, &category_id);
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

#[tokio::test]
async fn create_same_currency_returns_identity_detail_and_list_is_convert_only() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let created = repo
        .create_transaction(sample_transaction("Coffee"))
        .await
        .expect("create");

    assert_eq!(created.currency, "EUR");
    assert_eq!(
        created.exchange_rate.variant,
        zai_core::features::transactions::models::RateVariant::Identity
    );
    assert_eq!(created.converted_amount, Some(created.amount));
    assert_eq!(created.converted_currency, "EUR");
    assert!(created.complete);

    let page = repo
        .get_transactions(1, 10, None, None)
        .await
        .expect("list");
    assert_eq!(page.data.len(), 1);
    assert_eq!(page.data[0].converted_amount, Some(created.amount));
    assert_eq!(page.data[0].converted_currency, "EUR");
    assert!(page.data[0].complete);
}

#[tokio::test]
async fn amount_only_update_keeps_identity_and_revalues() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let created = repo
        .create_transaction(sample_transaction("Coffee"))
        .await
        .expect("create");

    let updated = repo
        .update_transaction(TransactionUpdate {
            id: created.id.clone(),
            description: created.description.clone(),
            amount: 2500,
            currency: created.currency.clone(),
            transaction_date: created.transaction_date,
            transaction_type: created.transaction_type.clone(),
            transaction_category_id: created.transaction_category_id.clone(),
            notes: created.notes.clone(),
            manual_exchange_rate: None,
            confirm_manual_rate_replacement: false,
            retry_rate_lookup: false,
        })
        .await
        .expect("update");

    assert_eq!(
        updated.exchange_rate.variant,
        zai_core::features::transactions::models::RateVariant::Identity
    );
    assert_eq!(updated.converted_amount, Some(2500));
    assert!(updated.complete);
}

#[tokio::test]
async fn missing_cross_currency_rate_leaves_pending_incomplete_list_row() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    {
        let conn = &mut get_connection(&repo.pool).expect("connection");
        diesel::sql_query(
            "INSERT INTO enabled_currencies (code, enabled_at, disabled_at) \
             VALUES ('USD', datetime('now'), NULL)",
        )
        .execute(conn)
        .expect("enable USD");
    }

    let mut payload = sample_transaction("Hotel");
    payload.currency = "USD".to_string();
    let created = repo.create_transaction(payload).await.expect("create USD");

    assert_eq!(
        created.exchange_rate.variant,
        zai_core::features::transactions::models::RateVariant::Pending
    );
    assert!(!created.complete);
    assert_eq!(created.converted_amount, None);

    let page = repo
        .get_transactions(1, 10, None, None)
        .await
        .expect("list");
    assert!(!page.data[0].complete);
    assert_eq!(page.data[0].converted_amount, None);
}

#[tokio::test]
async fn create_with_currency_that_is_not_enabled_fails() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let mut payload = sample_transaction("Hotel");
    payload.currency = "USD".to_string();
    let error = repo
        .create_transaction(payload)
        .await
        .expect_err("not enabled");
    assert_eq!(error.code(), zai_core::ErrorCode::CurrencyNotEnabled);
}
