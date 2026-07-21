use super::process_test_support::{local, seed_source, setup_service};
use super::seed::SeedRecurringSource;
use crate::schema::recurring_template_revisions;
use diesel::prelude::*;
use zai_core::features::recurring_transactions::{
    ProcessingWorkBudget, RecurringMutationOutcome, RecurringOccurrenceProcessor,
    RecurringTemplateInput, RecurringTransactionDocument, RecurringTransactionsServiceTrait,
    ScheduleIntervalUnit, ScheduleRule, UpdateRecurringTransaction,
};

fn base_seed(id: &str, name: &str) -> SeedRecurringSource {
    SeedRecurringSource {
        id: id.into(),
        name: name.into(),
        lifecycle: "active",
        total_occurrences: Some(12),
        fulfilled_count: 0,
        revision: 1,
        first_scheduled_local: local(2026, 1, 1, 9, 0),
        next_scheduled_local: local(2026, 1, 1, 9, 0),
        next_ordinal: 1,
        amount: 1000,
        transaction_type: "expense",
    }
}

fn update_from_document(document: &RecurringTransactionDocument) -> UpdateRecurringTransaction {
    UpdateRecurringTransaction {
        recurring_transaction_id: document.recurring_transaction.id.clone(),
        expected_revision: document.recurring_transaction.revision,
        name: document.recurring_transaction.name.clone(),
        schedule: document.schedule.rule.clone(),
        next_scheduled_local: document
            .occurrence_summary
            .next_scheduled_local
            .unwrap_or(document.schedule.first_scheduled_local),
        total_occurrences: document.recurring_transaction.total_occurrences,
        template: RecurringTemplateInput {
            description: document.template.description.clone(),
            amount: document.template.amount,
            transaction_type: document.template.transaction_type.clone(),
            transaction_category_id: document.template.transaction_category_id.clone(),
            notes: document.template.notes.clone(),
        },
    }
}

#[tokio::test]
async fn schedule_rule_edit_with_same_next_succeeds() {
    let observed = local(2026, 7, 21, 12, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-same-next".into(),
            name: "Same next".into(),
            lifecycle: "active",
            total_occurrences: None,
            fulfilled_count: 0,
            revision: 1,
            first_scheduled_local: local(2026, 8, 1, 9, 0),
            next_scheduled_local: local(2026, 8, 1, 9, 0),
            next_ordinal: 1,
            amount: 100,
            transaction_type: "expense",
        },
    )
    .await;

    let before = service.get_document("rt-same-next").await.expect("doc");
    let mut input = update_from_document(&before);
    input.schedule = ScheduleRule::Interval {
        every: 2,
        unit: ScheduleIntervalUnit::Week,
    };
    let outcome = service
        .update(input)
        .await
        .expect("schedule rule edit with same next");
    let RecurringMutationOutcome::Succeeded { document } = outcome else {
        panic!("expected Succeeded");
    };
    assert_eq!(
        document.schedule.rule,
        ScheduleRule::Interval {
            every: 2,
            unit: ScheduleIntervalUnit::Week,
        }
    );
    assert_eq!(
        document.head.as_ref().map(|h| h.next_scheduled_local),
        Some(local(2026, 8, 1, 9, 0))
    );
}

#[tokio::test]
async fn template_edit_before_first_scheduled_succeeds() {
    let observed = local(2026, 7, 21, 12, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-tmpl-early".into(),
            name: "Template early".into(),
            lifecycle: "active",
            total_occurrences: None,
            fulfilled_count: 0,
            revision: 1,
            first_scheduled_local: local(2026, 8, 1, 9, 0),
            next_scheduled_local: local(2026, 8, 1, 9, 0),
            next_ordinal: 1,
            amount: 100,
            transaction_type: "expense",
        },
    )
    .await;

    let before = service.get_document("rt-tmpl-early").await.expect("doc");
    let mut input = update_from_document(&before);
    input.template.amount = 2500;
    let outcome = service
        .update(input)
        .await
        .expect("template edit before first scheduled");
    let RecurringMutationOutcome::Succeeded { document } = outcome else {
        panic!("expected Succeeded");
    };
    assert_eq!(document.template.amount, 2500);
}

#[tokio::test]
async fn schedule_edit_retains_overdue_under_prior_revision() {
    let observed = local(2026, 4, 1, 12, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-sched".into(),
            name: "Schedule edit".into(),
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

    let before = service.get_document("rt-sched").await.expect("doc");
    let boundary = local(2026, 5, 1, 9, 0);
    let mut input = update_from_document(&before);
    input.schedule = ScheduleRule::Interval {
        every: 1,
        unit: ScheduleIntervalUnit::Month,
    };
    input.next_scheduled_local = boundary;
    let outcome = service.update(input).await.expect("edit schedule");
    let RecurringMutationOutcome::Succeeded { document } = outcome else {
        panic!("expected Succeeded");
    };
    assert_eq!(document.schedule.first_scheduled_local, boundary);
    assert_eq!(
        document.head.as_ref().map(|h| h.next_scheduled_local),
        Some(local(2026, 1, 1, 9, 0))
    );

    let first = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("overdue under old");
    assert_eq!(first.committed, 1);
    let after_first = service.get_document("rt-sched").await.expect("doc");
    assert_eq!(
        after_first.links.occurrences.items[0].scheduled_local,
        local(2026, 1, 1, 9, 0)
    );

    let catch_up = service
        .process_due(observed, ProcessingWorkBudget::occurrences(10), None)
        .await
        .expect("catch up");
    assert!(catch_up.committed >= 1);
    let after = service.get_document("rt-sched").await.expect("after");
    let under_new = after
        .links
        .occurrences
        .items
        .iter()
        .any(|item| item.scheduled_local == boundary);
    assert!(!under_new);
    assert_eq!(
        after.head.as_ref().map(|h| h.next_scheduled_local),
        Some(boundary)
    );
}

#[tokio::test]
async fn template_edit_is_future_only() {
    let observed = local(2026, 2, 1, 12, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-tmpl".into(),
            name: "Template edit".into(),
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

    service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("fulfill first");

    let before = service.get_document("rt-tmpl").await.expect("before");
    let first_txn = before.links.occurrences.items[0].transaction_id.clone();
    let old_amount = before.template.amount;

    let mut input = update_from_document(&before);
    input.template = RecurringTemplateInput {
        description: Some("Updated".into()),
        amount: 2500,
        transaction_type: "expense".into(),
        transaction_category_id: None,
        notes: None,
    };
    let outcome = service.update(input).await.expect("edit template");
    let RecurringMutationOutcome::Succeeded { document } = outcome else {
        panic!("expected Succeeded");
    };
    assert_eq!(document.template.amount, 2500);

    service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await
        .expect("second");
    let after = service.get_document("rt-tmpl").await.expect("after");
    assert_eq!(after.links.occurrences.items.len(), 2);
    assert_eq!(after.links.occurrences.items[1].transaction_id, first_txn);
    assert_ne!(after.template.amount, old_amount);

    let writer = repo.writer().clone();
    let closed = writer
        .exec(move |conn| {
            let count: i64 = recurring_template_revisions::table
                .filter(recurring_template_revisions::recurring_transaction_id.eq("rt-tmpl"))
                .filter(recurring_template_revisions::effective_until_local.is_not_null())
                .count()
                .get_result(conn)
                .map_err(crate::errors::StorageError::from)?;
            Ok(count)
        })
        .await
        .expect("count closed");
    assert_eq!(closed, 1);
}

#[tokio::test]
async fn count_edit_can_become_indefinite() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    let mut seed = base_seed("rt-indef", "Indef");
    seed.fulfilled_count = 2;
    seed.total_occurrences = Some(10);
    seed_source(&repo, seed).await;

    let before = service.get_document("rt-indef").await.expect("doc");
    let mut input = update_from_document(&before);
    input.total_occurrences = None;
    let outcome = service.update(input).await.expect("to indefinite");
    match outcome {
        RecurringMutationOutcome::Succeeded { document } => {
            assert_eq!(document.recurring_transaction.total_occurrences, None);
            assert!(document.head.is_some());
        }
        other => panic!("expected Succeeded, got {other:?}"),
    }
}

#[tokio::test]
async fn count_edit_completes_when_equal_to_fulfilled() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    let mut seed = base_seed("rt-count", "Count");
    seed.fulfilled_count = 3;
    seed.total_occurrences = Some(10);
    seed_source(&repo, seed).await;

    let before = service.get_document("rt-count").await.expect("doc");
    let mut input = update_from_document(&before);
    input.total_occurrences = Some(3);
    let outcome = service.update(input).await.expect("complete");
    match outcome {
        RecurringMutationOutcome::Succeeded { document } => {
            assert_eq!(
                document.recurring_transaction.lifecycle,
                zai_core::features::recurring_transactions::RecurringLifecycle::Completed
            );
            assert!(document.head.is_none());
            assert_eq!(document.recurring_transaction.total_occurrences, Some(3));
        }
        other => panic!("expected Succeeded, got {other:?}"),
    }
}

#[tokio::test]
async fn count_rejects_below_fulfilled() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
    let mut seed = base_seed("rt-low", "Low");
    seed.fulfilled_count = 4;
    seed_source(&repo, seed).await;

    let before = service.get_document("rt-low").await.expect("doc");
    let mut input = update_from_document(&before);
    input.total_occurrences = Some(2);
    let error = service.update(input).await.expect_err("below fulfilled");
    assert!(error.to_string().contains("fulfilled"));
}
