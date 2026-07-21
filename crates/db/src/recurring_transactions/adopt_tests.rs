use super::process_test_support::{local, setup_service};
use crate::connection::get_connection;
use crate::schema::{domain_alerts, recurring_occurrences, recurring_transactions, transactions};
use crate::transactions::models::TransactionRow;
use diesel::prelude::*;
use uuid::Uuid;
use zai_core::features::recurring_transactions::{
    AdoptRecurringTransaction, AdoptionPreviewRequest, FulfillmentKind,
    RECURRING_OCCURRENCE_PRODUCER_KEY, RecurringLifecycle, RecurringOccurrenceProcessor,
    RecurringTemplateInput, RecurringTransactionsServiceTrait, ScheduleIntervalUnit, ScheduleRule,
};
use zai_core::features::transactions::models::NewTransaction;

fn monthly() -> ScheduleRule {
    ScheduleRule::Interval {
        every: 1,
        unit: ScheduleIntervalUnit::Month,
    }
}

fn template_from(amount: i32) -> RecurringTemplateInput {
    RecurringTemplateInput {
        description: Some("Rent".into()),
        amount,
        transaction_type: "expense".into(),
        transaction_category_id: None,
        notes: Some("keep".into()),
    }
}

async fn insert_transaction(
    repo: &super::RecurringTransactionsRepository,
    id: &str,
    date: chrono::NaiveDateTime,
    amount: i32,
) {
    let row: TransactionRow = NewTransaction {
        id: Some(id.to_string()),
        description: Some("Rent".into()),
        amount,
        transaction_date: date,
        transaction_type: "expense".into(),
        transaction_category_id: None,
        notes: Some("keep".into()),
    }
    .into();
    repo.writer()
        .exec(move |conn| {
            diesel::insert_into(transactions::table)
                .values(&row)
                .execute(conn)
                .map_err(crate::errors::StorageError::from)
                .map(|_| ())
        })
        .await
        .expect("insert transaction");
}

#[tokio::test]
async fn adopt_preserves_transaction_records_occurrence_one_without_alert_and_catch_up() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    let txn_id = "txn-adopt-1";
    let first = local(2026, 4, 21, 10, 0);
    insert_transaction(&repo, txn_id, first, 120_000).await;

    let preview = service
        .preview_adoption(AdoptionPreviewRequest {
            transaction_id: txn_id.into(),
            schedule: monthly(),
            total_occurrences: Some(6),
        })
        .await
        .expect("preview");
    assert_eq!(preview.later_due_count, 3);
    assert_eq!(preview.first_scheduled_local, first);

    let outcome = service
        .adopt(AdoptRecurringTransaction {
            id: Some("rt-adopt".into()),
            transaction_id: txn_id.into(),
            name: "Monthly rent".into(),
            schedule: monthly(),
            total_occurrences: Some(6),
            template: template_from(120_000),
        })
        .await
        .expect("adopt");

    let document = match outcome {
        zai_core::features::recurring_transactions::RecurringAdoptOutcome::Succeeded {
            document,
        } => document,
    };
    assert_eq!(document.recurring_transaction.id, "rt-adopt");
    assert_eq!(document.recurring_transaction.fulfilled_count, 4);
    assert_eq!(document.links.occurrences.items.len(), 4);

    let adopted = document
        .links
        .occurrences
        .items
        .iter()
        .find(|item| item.fulfillment_kind == FulfillmentKind::Adopted)
        .expect("adopted occurrence");
    assert_eq!(adopted.ordinal, 1);
    assert_eq!(adopted.fulfillment_position, 1);
    assert_eq!(adopted.transaction_id, txn_id);
    assert!(adopted.recurring_alert_id.is_none());

    let pool = repo.pool().clone();
    let txn_snapshot = tokio::task::spawn_blocking(move || {
        let mut conn = get_connection(&pool).expect("conn");
        transactions::table
            .find(txn_id)
            .first::<TransactionRow>(&mut conn)
            .expect("txn")
    })
    .await
    .expect("join");
    assert_eq!(txn_snapshot.amount, 120_000);
    assert_eq!(txn_snapshot.notes.as_deref(), Some("keep"));
    assert_eq!(txn_snapshot.transaction_date, first);
    assert!(txn_snapshot.deleted_at.is_none());

    let pool = repo.pool().clone();
    let alert_count: i64 = tokio::task::spawn_blocking(move || {
        let mut conn = get_connection(&pool).expect("conn");
        domain_alerts::table
            .filter(domain_alerts::producer_key.eq(RECURRING_OCCURRENCE_PRODUCER_KEY))
            .count()
            .get_result(&mut conn)
            .expect("count")
    })
    .await
    .expect("join");
    // Three generated catch-up occurrences emit alerts; adopted does not.
    assert_eq!(alert_count, 3);
}

#[tokio::test]
async fn adopt_rejects_transaction_with_existing_provenance_including_tombstoned_source() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    let txn_id = "txn-already";
    insert_transaction(&repo, txn_id, local(2026, 6, 1, 9, 0), 50).await;

    service
        .adopt(AdoptRecurringTransaction {
            id: Some("rt-first".into()),
            transaction_id: txn_id.into(),
            name: "First".into(),
            schedule: monthly(),
            total_occurrences: Some(2),
            template: template_from(50),
        })
        .await
        .expect("first adopt");

    let pool = repo.pool().clone();
    tokio::task::spawn_blocking(move || {
        let mut conn = get_connection(&pool).expect("conn");
        diesel::update(recurring_transactions::table.find("rt-first"))
            .set((
                recurring_transactions::lifecycle.eq(RecurringLifecycle::Tombstoned.as_str()),
                recurring_transactions::deleted_at.eq(observed),
            ))
            .execute(&mut conn)
            .expect("tombstone");
    })
    .await
    .expect("join");

    let error = service
        .adopt(AdoptRecurringTransaction {
            id: Some("rt-second".into()),
            transaction_id: txn_id.into(),
            name: "Second".into(),
            schedule: monthly(),
            total_occurrences: Some(2),
            template: template_from(50),
        })
        .await
        .expect_err("duplicate adopt");
    assert!(
        error
            .to_string()
            .contains("already has recurring provenance")
    );
}

#[tokio::test]
async fn tombstoning_adopted_transaction_keeps_occurrence_and_finite_count() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    let txn_id = "txn-tombstone-adopted";
    insert_transaction(&repo, txn_id, local(2026, 7, 1, 9, 0), 80).await;

    service
        .adopt(AdoptRecurringTransaction {
            id: Some("rt-keep".into()),
            transaction_id: txn_id.into(),
            name: "Keep count".into(),
            schedule: monthly(),
            total_occurrences: Some(3),
            template: template_from(80),
        })
        .await
        .expect("adopt");

    let before = service.get_document("rt-keep").await.expect("document");
    assert_eq!(before.recurring_transaction.fulfilled_count, 1);

    let pool = repo.pool().clone();
    tokio::task::spawn_blocking(move || {
        let mut conn = get_connection(&pool).expect("conn");
        diesel::update(transactions::table.find(txn_id))
            .set(transactions::deleted_at.eq(observed))
            .execute(&mut conn)
            .expect("tombstone txn");
    })
    .await
    .expect("join");

    let after = service.get_document("rt-keep").await.expect("document");
    assert_eq!(after.recurring_transaction.fulfilled_count, 1);
    assert_eq!(after.links.occurrences.items.len(), 1);
    assert_eq!(
        after.links.occurrences.items[0].fulfillment_kind,
        FulfillmentKind::Adopted
    );

    let replay = service
        .process_due(
            observed,
            zai_core::features::recurring_transactions::ProcessingWorkBudget { max_occurrences: 5 },
        )
        .await
        .expect("replay");
    assert_eq!(replay.committed, 0);
    let still = service.get_document("rt-keep").await.expect("document");
    assert_eq!(still.recurring_transaction.fulfilled_count, 1);
}

#[tokio::test]
async fn provenance_hides_source_link_when_recurring_is_tombstoned() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    let txn_id = "txn-link";
    insert_transaction(&repo, txn_id, local(2026, 7, 10, 8, 0), 40).await;

    service
        .adopt(AdoptRecurringTransaction {
            id: Some(Uuid::new_v4().to_string()),
            transaction_id: txn_id.into(),
            name: "Hidden later".into(),
            schedule: monthly(),
            total_occurrences: Some(1),
            template: template_from(40),
        })
        .await
        .expect("adopt");

    let visible = service
        .get_transaction_provenance(txn_id)
        .await
        .expect("provenance")
        .expect("some");
    assert!(visible.source.is_some());

    let recurring_id = visible.occurrence.recurring_transaction_id.clone();
    let pool = repo.pool().clone();
    let tombstone_id = recurring_id.clone();
    tokio::task::spawn_blocking(move || {
        let mut conn = get_connection(&pool).expect("conn");
        diesel::update(recurring_transactions::table.find(tombstone_id))
            .set((
                recurring_transactions::lifecycle.eq(RecurringLifecycle::Tombstoned.as_str()),
                recurring_transactions::deleted_at.eq(observed),
            ))
            .execute(&mut conn)
            .expect("tombstone source");
    })
    .await
    .expect("join");

    let hidden = service
        .get_transaction_provenance(txn_id)
        .await
        .expect("provenance")
        .expect("some");
    assert!(hidden.source.is_none());
    assert_eq!(hidden.occurrence.recurring_transaction_id, recurring_id);

    let pool = repo.pool().clone();
    let occurrence_count: i64 = tokio::task::spawn_blocking(move || {
        let mut conn = get_connection(&pool).expect("conn");
        recurring_occurrences::table
            .filter(recurring_occurrences::transaction_id.eq(txn_id))
            .count()
            .get_result(&mut conn)
            .expect("count")
    })
    .await
    .expect("join");
    assert_eq!(occurrence_count, 1);
}
