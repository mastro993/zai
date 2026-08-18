use super::{
    INITIAL_ACTUAL_GENERATION_ID, ValuationsRepository, active_generation, sum_period_spending,
    sum_spending_buckets, SpendingBucketGrain,
};
use crate::connection::{create_pool, run_migrations};
use crate::sql_statement_counter::ConnectionStatementCounter;
use crate::test_utils::TempDb;
use crate::transactions::TransactionsRepository;
use crate::write_actor::spawn_writer;
use chrono::{TimeZone, Utc};
use diesel::prelude::*;
use diesel::sql_query;
use std::sync::Arc;
use zai_core::features::budgets::models::BudgetMeasurementMode;
use zai_core::features::transactions::models::NewTransaction;
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;
use zai_core::money::CurrencyCode;

fn setup() -> (
    TempDb,
    ValuationsRepository,
    TransactionsRepository,
    diesel::sqlite::SqliteConnection,
) {
    let temp_db = TempDb::new();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let repo = ValuationsRepository::new(Arc::clone(&pool), writer.clone());
    let transactions = TransactionsRepository::new(Arc::clone(&pool), writer);
    let conn = SqliteConnection::establish(temp_db.path()).expect("conn");
    (temp_db, repo, transactions, conn)
}

#[tokio::test]
async fn migration_installs_indexes_and_active_eur_generation() {
    let (_temp, repo, _, mut conn) = setup();
    let active = repo.active_actual().await.unwrap();
    assert_eq!(active.id, INITIAL_ACTUAL_GENERATION_ID);
    assert_eq!(active.target_currency, "EUR");
    for name in [
        "transaction_valuations_generation_date",
        "transaction_valuations_generation_converted",
        "transaction_valuations_generation_completeness",
        "transaction_exchange_rate_revisions_pending_retry",
        "valuation_generations_one_active",
    ] {
        let count = diesel::sql_query(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = ?",
        )
        .bind::<diesel::sql_types::Text, _>(name)
        .get_result::<crate::migration_tests::CountRow>(&mut conn)
        .expect("index");
        assert_eq!(count.count, 1, "{name}");
    }
}

#[tokio::test]
async fn ready_generation_rows_are_immutable() {
    let (_temp, repo, transactions, mut conn) = setup();
    transactions
        .create_transaction(NewTransaction {
            id: Some("tx-imm".to_string()),
            description: Some("Seed".to_string()),
            amount: 100,
            currency: "EUR".to_string(),
            transaction_date: Utc
                .with_ymd_and_hms(2026, 8, 10, 12, 0, 0)
                .unwrap()
                .naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
            manual_exchange_rate: None,
        })
        .await
        .expect("create");
    let built = repo
        .change_default_currency(
            CurrencyCode::parse("USD").unwrap(),
            Utc.with_ymd_and_hms(2026, 8, 18, 12, 0, 0)
                .unwrap()
                .naive_utc(),
        )
        .await
        .unwrap();
    assert_eq!(built.target_currency, "USD");
    let update = sql_query(
        "UPDATE transaction_valuations SET converted_amount = 1 WHERE generation_id = 'val-actual-1'",
    )
    .execute(&mut conn);
    assert!(update.is_err());
}

#[tokio::test]
async fn default_currency_change_switches_head_atomically() {
    let (_temp, repo, transactions, mut conn) = setup();
    transactions
        .create_transaction(NewTransaction {
            id: Some("tx-usd".to_string()),
            description: Some("Coffee".to_string()),
            amount: 400,
            currency: "EUR".to_string(),
            transaction_date: Utc
                .with_ymd_and_hms(2026, 8, 10, 12, 0, 0)
                .unwrap()
                .naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
            manual_exchange_rate: None,
        })
        .await
        .expect("create");
    let before = active_generation(&mut conn).unwrap();
    assert_eq!(before.target_currency, "EUR");
    let after = repo
        .change_default_currency(
            CurrencyCode::parse("USD").unwrap(),
            Utc.with_ymd_and_hms(2026, 8, 18, 12, 0, 0)
                .unwrap()
                .naive_utc(),
        )
        .await
        .unwrap();
    assert_eq!(after.target_currency, "USD");
    assert_ne!(after.id, before.id);
    let heads =
        diesel::sql_query("SELECT COUNT(*) AS count FROM valuation_heads WHERE kind = 'actual'")
            .get_result::<crate::migration_tests::CountRow>(&mut conn)
            .expect("heads");
    assert_eq!(heads.count, 1);
    let mixed = diesel::sql_query(
        "SELECT COUNT(*) AS count FROM valuation_generations WHERE status = 'active'",
    )
    .get_result::<crate::migration_tests::CountRow>(&mut conn)
    .expect("active");
    assert_eq!(mixed.count, 1);
}

#[tokio::test]
async fn pending_rate_marks_period_incomplete_and_adds_no_converted_value() {
    let (_temp, _, transactions, mut conn) = setup();
    let created = transactions
        .create_transaction(NewTransaction {
            id: Some("tx-pending".to_string()),
            description: Some("Pending".to_string()),
            amount: 1_200,
            currency: "EUR".to_string(),
            transaction_date: Utc
                .with_ymd_and_hms(2026, 8, 10, 12, 0, 0)
                .unwrap()
                .naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
            manual_exchange_rate: None,
        })
        .await
        .expect("create");
    sql_query("UPDATE transactions SET currency = 'USD' WHERE id = ?")
        .bind::<diesel::sql_types::Text, _>(&created.id)
        .execute(&mut conn)
        .expect("usd");
    sql_query(
        "UPDATE transaction_exchange_rate_revisions \
         SET variant = 'pending', original_decimal = NULL, coefficient = NULL, scale = NULL \
         WHERE transaction_id = ?",
    )
    .bind::<diesel::sql_types::Text, _>(&created.id)
    .execute(&mut conn)
    .expect("pending");
    let row = {
        use crate::schema::transactions;
        transactions::table
            .filter(transactions::id.eq(&created.id))
            .first::<crate::transactions::models::TransactionRow>(&mut conn)
            .expect("row")
    };
    crate::valuations::upsert_transaction_valuation(&mut conn, &row).expect("refresh");
    let start = Utc
        .with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
        .unwrap()
        .naive_utc();
    let end = Utc
        .with_ymd_and_hms(2026, 9, 1, 0, 0, 0)
        .unwrap()
        .naive_utc();
    let spending = sum_period_spending(&mut conn, start, end, BudgetMeasurementMode::Spending, &[])
        .expect("sum");
    assert!(!spending.complete);
    assert_eq!(spending.known_sum, 0);
}

#[tokio::test]
async fn set_based_sum_is_one_statement() {
    let (_temp, _, transactions, mut conn) = setup();
    for index in 0..5 {
        transactions
            .create_transaction(NewTransaction {
                id: Some(format!("tx-{index}")),
                description: Some("Seed".to_string()),
                amount: 100,
                currency: "EUR".to_string(),
                transaction_date: Utc
                    .with_ymd_and_hms(2026, 8, 10, 12, 0, 0)
                    .unwrap()
                    .naive_utc(),
                transaction_type: "expense".to_string(),
                transaction_category_id: None,
                notes: None,
                manual_exchange_rate: None,
            })
            .await
            .expect("create");
    }
    let counter = ConnectionStatementCounter::install(&mut conn);
    let start = Utc
        .with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
        .unwrap()
        .naive_utc();
    let end = Utc
        .with_ymd_and_hms(2026, 9, 1, 0, 0, 0)
        .unwrap()
        .naive_utc();
    let spending = sum_period_spending(&mut conn, start, end, BudgetMeasurementMode::Spending, &[])
        .expect("sum");
    assert_eq!(spending.known_sum, 500);
    assert!(spending.complete);
    assert_eq!(counter.count(), 1);
}

#[tokio::test]
async fn spending_buckets_keep_known_sum_and_mark_incomplete_days() {
    let (_temp, _, transactions, mut conn) = setup();
    transactions
        .create_transaction(NewTransaction {
            id: Some("tx-day-1".to_string()),
            description: Some("Complete".to_string()),
            amount: 100,
            currency: "EUR".to_string(),
            transaction_date: Utc
                .with_ymd_and_hms(2026, 8, 10, 12, 0, 0)
                .unwrap()
                .naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
            manual_exchange_rate: None,
        })
        .await
        .expect("complete");
    transactions
        .create_transaction(NewTransaction {
            id: Some("tx-day-2".to_string()),
            description: Some("Pending".to_string()),
            amount: 200,
            currency: "EUR".to_string(),
            transaction_date: Utc
                .with_ymd_and_hms(2026, 8, 11, 12, 0, 0)
                .unwrap()
                .naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
            manual_exchange_rate: None,
        })
        .await
        .expect("pending seed");
    sql_query("UPDATE transactions SET currency = 'USD' WHERE id = 'tx-day-2'")
        .execute(&mut conn)
        .expect("usd");
    sql_query(
        "UPDATE transaction_exchange_rate_revisions \
         SET variant = 'pending', original_decimal = NULL, coefficient = NULL, scale = NULL \
         WHERE transaction_id = 'tx-day-2'",
    )
    .execute(&mut conn)
    .expect("pending");
    let row = {
        use crate::schema::transactions;
        transactions::table
            .filter(transactions::id.eq("tx-day-2"))
            .first::<crate::transactions::models::TransactionRow>(&mut conn)
            .expect("row")
    };
    crate::valuations::upsert_transaction_valuation(&mut conn, &row).expect("refresh");

    let start = Utc
        .with_ymd_and_hms(2026, 8, 1, 0, 0, 0)
        .unwrap()
        .naive_utc();
    let end = Utc
        .with_ymd_and_hms(2026, 9, 1, 0, 0, 0)
        .unwrap()
        .naive_utc();
    let days = sum_spending_buckets(
        &mut conn,
        start,
        end,
        BudgetMeasurementMode::Spending,
        &[],
        SpendingBucketGrain::Day,
    )
    .expect("days");
    assert_eq!(days.len(), 2);
    assert!(days[0].complete);
    assert_eq!(days[0].known_sum, 100);
    assert!(!days[1].complete);
    assert_eq!(days[1].known_sum, 0);

    let months = sum_spending_buckets(
        &mut conn,
        start,
        end,
        BudgetMeasurementMode::Spending,
        &[],
        SpendingBucketGrain::Month,
    )
    .expect("months");
    assert_eq!(months.len(), 1);
    assert!(!months[0].complete);
    assert_eq!(months[0].known_sum, 100);
}
