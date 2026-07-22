use super::process_test_support::{local, seed_source, setup_service};
use super::seed::SeedRecurringSource;
use crate::schema::{
    recurring_generation_failures, recurring_schedule_revisions, recurring_transactions,
};
use diesel::prelude::*;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    RecurringMutationOutcome, RecurringTemplateInput, RecurringTransactionDocument,
    RecurringTransactionsServiceTrait, ScheduleRule, UNCHANGED_GENERATION_BLOCKED,
    UpdateRecurringTransaction,
};

fn base_seed(id: &str, description: &str) -> SeedRecurringSource {
    SeedRecurringSource {
        id: id.into(),
        description: description.into(),
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
async fn generation_blocked_blocks_configuration_edits() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (schedule_id, _) = seed_source(&repo, base_seed("rt-block", "Blocked")).await;

    let writer = repo.writer().clone();
    let schedule_id_clone = schedule_id.clone();
    writer
        .exec(move |conn| {
            diesel::sql_query(
                "INSERT INTO domain_alerts (id, producer_key, occurrence_key, severity, title, body, created_at, updated_at) \
                 VALUES ('alert-1', 'recurring.generation_failure', 'rt-block|sched|1', 'critical', 'Blocked', 'Needs repair', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            )
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            diesel::insert_into(recurring_generation_failures::table)
                .values((
                    recurring_generation_failures::recurring_transaction_id.eq("rt-block"),
                    recurring_generation_failures::schedule_revision_id.eq(&schedule_id_clone),
                    recurring_generation_failures::ordinal.eq(1),
                    recurring_generation_failures::error_code.eq("template_invalid"),
                    recurring_generation_failures::cause_category.eq("validation"),
                    recurring_generation_failures::repair_field_key.eq(Some("amount".to_string())),
                    recurring_generation_failures::correlation_id.eq("corr-1"),
                    recurring_generation_failures::failed_scheduled_local
                        .eq(local(2026, 1, 1, 9, 0)),
                    recurring_generation_failures::first_failed_at.eq(observed),
                    recurring_generation_failures::last_failed_at.eq(observed),
                    recurring_generation_failures::attempt_count.eq(1),
                    recurring_generation_failures::generation_failure_alert_id.eq("alert-1"),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("seed failure");

    let before = service.get_document("rt-block").await.expect("doc");
    let mut count = update_from_document(&before);
    count.template.description = "Still changed".into();
    count.total_occurrences = None;
    let count = service.update(count).await.expect("blocked count");
    match count {
        RecurringMutationOutcome::Unchanged { reason, .. } => {
            assert_eq!(reason, UNCHANGED_GENERATION_BLOCKED);
        }
        other => panic!("expected Unchanged, got {other:?}"),
    }
}

#[tokio::test]
async fn revision_conflict_when_stale_and_different() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-conflict", "Conflict")).await;
    let before = service.get_document("rt-conflict").await.expect("doc");

    let mut first = update_from_document(&before);
    first.template.description = "First".into();
    service.update(first).await.expect("first");

    let mut stale = update_from_document(&before);
    stale.template.description = "Second".into();
    let error = service.update(stale).await.expect_err("stale");
    assert!(matches!(
        error,
        Error::RevisionConflict {
            current_revision: 2
        }
    ));
}

#[tokio::test]
async fn schedule_property_monthly_day_and_leap_year_clamp() {
    let observed = local(2024, 2, 1, 12, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-leap".into(),
            description: "Leap".into(),
            lifecycle: "active",
            total_occurrences: None,
            fulfilled_count: 0,
            revision: 1,
            first_scheduled_local: local(2024, 1, 31, 9, 0),
            next_scheduled_local: local(2024, 1, 31, 9, 0),
            next_ordinal: 1,
            amount: 50,
            transaction_type: "expense",
        },
    )
    .await;

    let before = service.get_document("rt-leap").await.expect("doc");
    let boundary = local(2024, 2, 29, 9, 0);
    let mut input = update_from_document(&before);
    input.schedule = ScheduleRule::MonthlyDay { day: 31 };
    input.next_scheduled_local = boundary;
    let outcome = service.update(input).await.expect("monthly day");
    let RecurringMutationOutcome::Succeeded { document } = outcome else {
        panic!("expected Succeeded");
    };
    assert_eq!(document.schedule.rule, ScheduleRule::MonthlyDay { day: 31 });
    assert_eq!(document.schedule.first_scheduled_local, boundary);

    let sequences = repo
        .writer()
        .clone()
        .exec(move |conn| {
            let rows: Vec<(i32, Option<chrono::NaiveDateTime>)> =
                recurring_schedule_revisions::table
                    .filter(recurring_schedule_revisions::recurring_transaction_id.eq("rt-leap"))
                    .select((
                        recurring_schedule_revisions::sequence,
                        recurring_schedule_revisions::effective_until_local,
                    ))
                    .order(recurring_schedule_revisions::sequence.asc())
                    .load(conn)
                    .map_err(crate::errors::StorageError::from)?;
            Ok(rows)
        })
        .await
        .expect("sequences");
    assert_eq!(sequences.len(), 2);
    assert_eq!(sequences[0].1, Some(boundary));
    assert_eq!(sequences[1].1, None);
}

#[tokio::test]
async fn paused_source_remains_editable_without_generation_block() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-paused", "Paused")).await;
    repo.writer()
        .clone()
        .exec(move |conn| {
            diesel::update(
                recurring_transactions::table.filter(recurring_transactions::id.eq("rt-paused")),
            )
            .set((
                recurring_transactions::lifecycle.eq("paused"),
                recurring_transactions::paused_at.eq(Some(observed)),
            ))
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("set paused");

    let before = service.get_document("rt-paused").await.expect("doc");
    let mut input = update_from_document(&before);
    input.total_occurrences = None;
    let outcome = service.update(input).await.expect("paused editable");
    assert!(matches!(
        outcome,
        RecurringMutationOutcome::Succeeded { .. }
    ));
}
