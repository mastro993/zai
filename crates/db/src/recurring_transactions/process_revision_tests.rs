#![allow(dead_code, unused_imports)]

use super::process_test_support::{local, process_until_caught_up, seed_source, setup_service};
use super::seed::SeedRecurringSource;
use crate::schema::{recurring_generation_failures, transaction_categories};
use diesel::prelude::*;
use zai_core::features::recurring_transactions::{
    FulfillmentKind, ProcessingWorkBudget, RECURRING_GENERATION_FAILURE_PRODUCER_KEY,
    RecurringOccurrenceProcessor, RecurringTransactionsServiceTrait,
};

#[tokio::test]
async fn advancing_across_schedule_revision_recomputes_under_new_rule() {
    let observed = local(2026, 4, 1, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (old_schedule, _) = seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-rev".into(),
            description: "Revision boundary".into(),
            lifecycle: "active",
            total_occurrences: None,
            fulfilled_count: 0,
            revision: 1,
            first_scheduled_local: local(2026, 1, 1, 9, 0),
            next_scheduled_local: local(2026, 1, 1, 9, 0),
            next_ordinal: 1,
            amount: 100,
            transaction_type: "expense",
        },
    )
    .await;

    let writer = repo.writer().clone();
    let old_schedule_id = old_schedule.clone();
    writer
        .exec(move |conn| {
            use crate::schema::recurring_schedule_revisions;
            diesel::update(
                recurring_schedule_revisions::table
                    .filter(recurring_schedule_revisions::id.eq(&old_schedule_id)),
            )
            .set(
                recurring_schedule_revisions::effective_until_local
                    .eq(Some(local(2026, 2, 1, 9, 0))),
            )
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            diesel::insert_into(recurring_schedule_revisions::table)
                .values((
                    recurring_schedule_revisions::id.eq("rt-rev-sched-2"),
                    recurring_schedule_revisions::recurring_transaction_id.eq("rt-rev"),
                    recurring_schedule_revisions::sequence.eq(2),
                    recurring_schedule_revisions::effective_from_local.eq(local(2026, 2, 1, 9, 0)),
                    recurring_schedule_revisions::effective_until_local
                        .eq(None::<chrono::NaiveDateTime>),
                    recurring_schedule_revisions::first_scheduled_local
                        .eq(local(2026, 2, 15, 9, 0)),
                    recurring_schedule_revisions::interval_every.eq(Some(1)),
                    recurring_schedule_revisions::interval_unit.eq(Some("month".to_string())),
                    recurring_schedule_revisions::monthly_day.eq(None::<i32>),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("seed revision boundary");

    let first = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("first");
    assert_eq!(first.committed, 1);

    let document = service.get_document("rt-rev").await.expect("document");
    let head = document.head.expect("head");
    assert_eq!(head.schedule_revision_id, "rt-rev-sched-2");
    assert_eq!(head.next_ordinal, 1);
    assert_eq!(head.next_scheduled_local, local(2026, 2, 15, 9, 0));

    let second = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("second under new revision");
    assert_eq!(second.committed, 1);
    let after = service.get_document("rt-rev").await.expect("after");
    assert_eq!(after.links.occurrences.items.len(), 2);
    assert_eq!(
        after.links.occurrences.items[0].schedule_revision_id,
        "rt-rev-sched-2"
    );
    assert_eq!(
        after.links.occurrences.items[0].scheduled_local,
        local(2026, 2, 15, 9, 0)
    );
}
