use super::fulfill::FAIL_AFTER_TRANSACTION_INSERT;
use super::process_test_support::{local, process_until_caught_up, setup_service};
use crate::connection::get_connection;
use crate::schema::transactions;
use crate::transactions::models::TransactionRow;
use crate::transactions::rate_revisions::apply_create_rate;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Integer, Text};
use std::sync::atomic::Ordering;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    AdoptRecurringTransaction, NewRecurringTransaction, ProcessingWorkBudget,
    RecurringCreateOutcome, RecurringMutationOutcome, RecurringOccurrenceProcessor,
    RecurringTemplateInput, ScheduleIntervalUnit, ScheduleRule, UpdateRecurringTransaction,
};
use zai_core::features::transactions::models::NewTransaction;

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

#[derive(QueryableByName)]
struct RateRow {
    #[diesel(sql_type = Integer)]
    sequence: i32,
    #[diesel(sql_type = Text)]
    variant: String,
    #[diesel(sql_type = Text)]
    rate_date: String,
}

fn monthly() -> ScheduleRule {
    ScheduleRule::Interval {
        every: 1,
        unit: ScheduleIntervalUnit::Month,
    }
}

fn usd_template(amount: i32) -> RecurringTemplateInput {
    RecurringTemplateInput {
        description: "Rent".into(),
        amount,
        currency: "USD".into(),
        transaction_type: "expense".into(),
        transaction_category_id: None,
        notes: None,
    }
}

async fn enable_usd(repo: &super::RecurringTransactionsRepository) {
    repo.writer()
        .exec(|conn| {
            sql_query(
                "INSERT INTO enabled_currencies (code, enabled_at, disabled_at) \
                 VALUES ('USD', datetime('now'), NULL)",
            )
            .execute(conn)
            .map_err(crate::errors::StorageError::from)
            .map(|_| ())
        })
        .await
        .expect("enable USD");
}

async fn disable_usd(repo: &super::RecurringTransactionsRepository) {
    repo.writer()
        .exec(|conn| {
            sql_query(
                "UPDATE enabled_currencies SET disabled_at = datetime('now') WHERE code = 'USD'",
            )
            .execute(conn)
            .map_err(crate::errors::StorageError::from)
            .map(|_| ())
        })
        .await
        .expect("disable USD");
}

fn valuation_count(repo: &super::RecurringTransactionsRepository, transaction_id: &str) -> i64 {
    let pool = repo.pool().clone();
    let mut conn = get_connection(&pool).expect("conn");
    sql_query("SELECT COUNT(*) AS count FROM transaction_valuations WHERE transaction_id = ?")
        .bind::<Text, _>(transaction_id)
        .get_result::<CountRow>(&mut conn)
        .expect("valuation count")
        .count
}

fn latest_rate(repo: &super::RecurringTransactionsRepository, transaction_id: &str) -> RateRow {
    let pool = repo.pool().clone();
    let mut conn = get_connection(&pool).expect("conn");
    sql_query(
        "SELECT sequence, variant, rate_date FROM transaction_exchange_rate_revisions \
         WHERE transaction_id = ? ORDER BY sequence DESC LIMIT 1",
    )
    .bind::<Text, _>(transaction_id)
    .get_result::<RateRow>(&mut conn)
    .expect("rate revision")
}

fn transaction_currency(
    repo: &super::RecurringTransactionsRepository,
    transaction_id: &str,
) -> String {
    let pool = repo.pool().clone();
    let mut conn = get_connection(&pool).expect("conn");
    transactions::table
        .find(transaction_id)
        .select(transactions::currency)
        .first(&mut conn)
        .expect("transaction currency")
}

#[tokio::test]
async fn create_persists_template_money_and_never_a_rate() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    enable_usd(&repo).await;

    let RecurringCreateOutcome::Succeeded { document } = service
        .create(NewRecurringTransaction {
            id: Some("rt-usd".into()),
            schedule: monthly(),
            first_scheduled_local: local(2026, 8, 1, 9, 0),
            total_occurrences: None,
            template: usd_template(120_000),
        })
        .await
        .expect("create");

    assert_eq!(document.template.amount, 120_000);
    assert_eq!(document.template.currency, "USD");
    let json = serde_json::to_value(&document.template).expect("json");
    assert!(json.get("exchangeRate").is_none());
}

#[tokio::test]
async fn fulfillment_writes_transaction_locked_rate_and_valuation_together() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    enable_usd(&repo).await;

    service
        .create(NewRecurringTransaction {
            id: Some("rt-usd-fulfill".into()),
            schedule: monthly(),
            first_scheduled_local: local(2026, 2, 1, 9, 0),
            total_occurrences: Some(1),
            template: usd_template(2500),
        })
        .await
        .expect("create");

    process_until_caught_up(&service, observed, 1)
        .await
        .expect("fulfill");

    let document = service
        .get_document("rt-usd-fulfill")
        .await
        .expect("document");
    let transaction_id = &document.links.occurrences.items[0].transaction_id;
    assert_eq!(transaction_currency(&repo, transaction_id), "USD");
    let rate = latest_rate(&repo, transaction_id);
    assert_eq!(rate.sequence, 1);
    assert_eq!(rate.variant, "pending");
    assert!(rate.rate_date.starts_with("2026-02-01"));
    assert_eq!(valuation_count(&repo, transaction_id), 1);
}

#[tokio::test]
async fn adoption_keeps_the_existing_rate_revision() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let txn_id = "txn-adopt-rate";
    let first = local(2026, 4, 21, 10, 0);
    repo.writer()
        .exec(move |conn| {
            let row = TransactionRow::from_new(NewTransaction {
                id: Some(txn_id.to_string()),
                description: Some("Rent".into()),
                amount: 120_000,
                currency: "EUR".into(),
                transaction_date: first,
                transaction_type: "expense".into(),
                transaction_category_id: None,
                notes: None,
                manual_exchange_rate: None,
            });
            diesel::insert_into(transactions::table)
                .values(&row)
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            apply_create_rate(conn, &row, None).map_err(crate::errors::StorageError::from)
        })
        .await
        .expect("insert completed transaction");

    let before = latest_rate(&repo, txn_id);
    service
        .adopt(AdoptRecurringTransaction {
            id: Some("rt-adopt-rate".into()),
            transaction_id: txn_id.into(),
            expected_transaction_date: first,
            schedule: monthly(),
            total_occurrences: Some(6),
            template: RecurringTemplateInput {
                description: "Rent".into(),
                amount: 120_000,
                currency: "EUR".into(),
                transaction_type: "expense".into(),
                transaction_category_id: None,
                notes: None,
            },
        })
        .await
        .expect("adopt");

    let after = latest_rate(&repo, txn_id);
    assert_eq!(after.sequence, before.sequence);
    assert_eq!(after.variant, before.variant);
    assert_eq!(transaction_currency(&repo, txn_id), "EUR");
}

#[tokio::test]
async fn disabled_template_currency_stays_and_rates_are_still_written() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    enable_usd(&repo).await;
    service
        .create(NewRecurringTransaction {
            id: Some("rt-disabled-usd".into()),
            schedule: monthly(),
            first_scheduled_local: local(2026, 2, 1, 9, 0),
            total_occurrences: Some(1),
            template: usd_template(800),
        })
        .await
        .expect("create");
    disable_usd(&repo).await;

    let before = service
        .get_document("rt-disabled-usd")
        .await
        .expect("document");
    assert_eq!(before.template.currency, "USD");

    process_until_caught_up(&service, observed, 1)
        .await
        .expect("fulfill");
    let document = service
        .get_document("rt-disabled-usd")
        .await
        .expect("document");
    assert_eq!(document.template.currency, "USD");
    let transaction_id = &document.links.occurrences.items[0].transaction_id;
    assert_eq!(transaction_currency(&repo, transaction_id), "USD");
    assert_eq!(latest_rate(&repo, transaction_id).sequence, 1);
    assert_eq!(valuation_count(&repo, transaction_id), 1);
}

fn update_from_document(
    document: &zai_core::features::recurring_transactions::RecurringTransactionDocument,
) -> UpdateRecurringTransaction {
    UpdateRecurringTransaction {
        recurring_transaction_id: document.recurring_transaction.id.clone(),
        expected_revision: document.recurring_transaction.revision,
        schedule: document.schedule.rule.clone(),
        next_scheduled_local: document
            .occurrence_summary
            .next_scheduled_local
            .unwrap_or(document.schedule.first_scheduled_local),
        total_occurrences: document.recurring_transaction.total_occurrences,
        template: RecurringTemplateInput {
            description: document.template.description.clone(),
            amount: document.template.amount,
            currency: document.template.currency.clone(),
            transaction_type: document.template.transaction_type.clone(),
            transaction_category_id: document.template.transaction_category_id.clone(),
            notes: document.template.notes.clone(),
        },
    }
}

#[tokio::test]
async fn create_rejects_a_disabled_template_currency() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    enable_usd(&repo).await;
    disable_usd(&repo).await;

    let error = service
        .create(NewRecurringTransaction {
            id: Some("rt-disabled-create".into()),
            schedule: monthly(),
            first_scheduled_local: local(2026, 8, 1, 9, 0),
            total_occurrences: None,
            template: usd_template(500),
        })
        .await
        .expect_err("disabled create");
    assert!(matches!(error, Error::CurrencyNotEnabled(code) if code == "USD"));
}

#[tokio::test]
async fn same_currency_edit_keeps_a_disabled_template_currency() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    enable_usd(&repo).await;
    service
        .create(NewRecurringTransaction {
            id: Some("rt-keep-usd".into()),
            schedule: monthly(),
            first_scheduled_local: local(2026, 8, 1, 9, 0),
            total_occurrences: None,
            template: usd_template(800),
        })
        .await
        .expect("create");
    disable_usd(&repo).await;

    let before = service.get_document("rt-keep-usd").await.expect("document");
    let mut update = update_from_document(&before);
    update.template.amount = 900;
    let RecurringMutationOutcome::Succeeded { document } =
        service.update(update).await.expect("same-currency edit")
    else {
        panic!("expected Succeeded");
    };
    assert_eq!(document.template.currency, "USD");
    assert_eq!(document.template.amount, 900);
}

#[tokio::test]
async fn switching_template_currency_still_requires_a_selectable_code() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    enable_usd(&repo).await;
    disable_usd(&repo).await;
    service
        .create(NewRecurringTransaction {
            id: Some("rt-switch-usd".into()),
            schedule: monthly(),
            first_scheduled_local: local(2026, 8, 1, 9, 0),
            total_occurrences: None,
            template: RecurringTemplateInput {
                description: "Rent".into(),
                amount: 1000,
                currency: "EUR".into(),
                transaction_type: "expense".into(),
                transaction_category_id: None,
                notes: None,
            },
        })
        .await
        .expect("create");

    let before = service
        .get_document("rt-switch-usd")
        .await
        .expect("document");
    let mut update = update_from_document(&before);
    update.template.currency = "USD".into();
    let error = service.update(update).await.expect_err("disabled switch");
    assert!(matches!(error, Error::CurrencyNotEnabled(code) if code == "USD"));
}

#[tokio::test]
async fn adoption_keeps_a_disabled_source_currency_and_its_rate_revision() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    enable_usd(&repo).await;
    let txn_id = "txn-adopt-disabled-usd";
    let first = local(2026, 4, 21, 10, 0);
    repo.writer()
        .exec(move |conn| {
            let row = TransactionRow::from_new(NewTransaction {
                id: Some(txn_id.to_string()),
                description: Some("Rent".into()),
                amount: 120_000,
                currency: "USD".into(),
                transaction_date: first,
                transaction_type: "expense".into(),
                transaction_category_id: None,
                notes: None,
                manual_exchange_rate: None,
            });
            diesel::insert_into(transactions::table)
                .values(&row)
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            apply_create_rate(conn, &row, None).map_err(crate::errors::StorageError::from)
        })
        .await
        .expect("insert completed transaction");
    disable_usd(&repo).await;

    let before = latest_rate(&repo, txn_id);
    service
        .adopt(AdoptRecurringTransaction {
            id: Some("rt-adopt-disabled-usd".into()),
            transaction_id: txn_id.into(),
            expected_transaction_date: first,
            schedule: monthly(),
            total_occurrences: Some(6),
            template: usd_template(120_000),
        })
        .await
        .expect("adopt");

    let after = latest_rate(&repo, txn_id);
    assert_eq!(after.sequence, before.sequence);
    assert_eq!(after.variant, before.variant);
    assert_eq!(transaction_currency(&repo, txn_id), "USD");
    let document = service
        .get_document("rt-adopt-disabled-usd")
        .await
        .expect("document");
    assert_eq!(document.template.currency, "USD");
}

#[tokio::test]
async fn catch_up_writes_a_locked_rate_and_valuation_for_each_occurrence() {
    let observed = local(2026, 4, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    enable_usd(&repo).await;

    service
        .create(NewRecurringTransaction {
            id: Some("rt-usd-catchup".into()),
            schedule: monthly(),
            first_scheduled_local: local(2026, 2, 1, 9, 0),
            total_occurrences: Some(3),
            template: usd_template(2500),
        })
        .await
        .expect("create");

    process_until_caught_up(&service, observed, 3)
        .await
        .expect("catch-up");

    let document = service
        .get_document("rt-usd-catchup")
        .await
        .expect("document");
    assert_eq!(document.links.occurrences.items.len(), 3);
    for item in &document.links.occurrences.items {
        assert_eq!(transaction_currency(&repo, &item.transaction_id), "USD");
        assert_eq!(latest_rate(&repo, &item.transaction_id).sequence, 1);
        assert_eq!(valuation_count(&repo, &item.transaction_id), 1);
    }
}

#[tokio::test]
async fn fulfillment_failure_rolls_back_rate_and_valuation_with_the_transaction() {
    let observed = local(2026, 2, 10, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    enable_usd(&repo).await;
    service
        .create(NewRecurringTransaction {
            id: Some("rt-usd-atomic".into()),
            schedule: monthly(),
            first_scheduled_local: local(2026, 2, 1, 9, 0),
            total_occurrences: Some(1),
            template: usd_template(2500),
        })
        .await
        .expect("create");

    FAIL_AFTER_TRANSACTION_INSERT.store(true, Ordering::SeqCst);
    let error = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect_err("injected failure");
    FAIL_AFTER_TRANSACTION_INSERT.store(false, Ordering::SeqCst);
    assert!(error.to_string().contains("Injected fulfillment failure"));

    let pool = repo.pool().clone();
    let mut conn = get_connection(&pool).expect("conn");
    let txn_count: i64 = transactions::table
        .count()
        .get_result(&mut conn)
        .expect("txn count");
    let rate_count = sql_query("SELECT COUNT(*) AS count FROM transaction_exchange_rate_revisions")
        .get_result::<CountRow>(&mut conn)
        .expect("rate count")
        .count;
    let value_count = sql_query("SELECT COUNT(*) AS count FROM transaction_valuations")
        .get_result::<CountRow>(&mut conn)
        .expect("valuation count")
        .count;
    assert_eq!(txn_count, 0);
    assert_eq!(rate_count, 0);
    assert_eq!(value_count, 0);
}
