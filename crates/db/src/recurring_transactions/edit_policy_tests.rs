use super::process_test_support::{local, seed_source, setup_service};
use super::seed::SeedRecurringSource;
use crate::schema::{
    recurring_generation_failures, recurring_schedule_revisions,
    recurring_transactions,
};
use diesel::prelude::*;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    EditRecurringCount, EditRecurringSchedule,
    RecurringMutationOutcome,
    RecurringTransactionsServiceTrait, RenameRecurringTransaction,
    ScheduleRule, UNCHANGED_GENERATION_BLOCKED,
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

#[tokio::test]
async fn generation_blocked_blocks_config_but_allows_rename() {
    let observed = local(2026, 7, 21, 10, 0);
    let (_db, service, repo, _lock) = setup_service(observed).await;
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

    let rename = service
        .rename(RenameRecurringTransaction {
            recurring_transaction_id: "rt-block".into(),
            expected_revision: 1,
            name: "Still renameable".into(),
        })
        .await
        .expect("rename while blocked");
    assert!(matches!(rename, RecurringMutationOutcome::Succeeded { .. }));

    let count = service
        .edit_count(EditRecurringCount {
            recurring_transaction_id: "rt-block".into(),
            expected_revision: 2,
            total_occurrences: None,
        })
        .await
        .expect("blocked count");
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
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-conflict", "Conflict")).await;

    service
        .rename(RenameRecurringTransaction {
            recurring_transaction_id: "rt-conflict".into(),
            expected_revision: 1,
            name: "First".into(),
        })
        .await
        .expect("first");

    let error = service
        .rename(RenameRecurringTransaction {
            recurring_transaction_id: "rt-conflict".into(),
            expected_revision: 1,
            name: "Second".into(),
        })
        .await
        .expect_err("stale");
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
    let (_db, service, repo, _lock) = setup_service(observed).await;
    seed_source(
        &repo,
        SeedRecurringSource {
            id: "rt-leap".into(),
            name: "Leap".into(),
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

    let boundary = local(2024, 2, 29, 9, 0);
    let outcome = service
        .edit_schedule(EditRecurringSchedule {
            recurring_transaction_id: "rt-leap".into(),
            expected_revision: 1,
            schedule: ScheduleRule::MonthlyDay { day: 31 },
            next_scheduled_local: boundary,
        })
        .await
        .expect("monthly day");
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
    let (_db, service, repo, _lock) = setup_service(observed).await;
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

    let outcome = service
        .edit_count(EditRecurringCount {
            recurring_transaction_id: "rt-paused".into(),
            expected_revision: 1,
            total_occurrences: None,
        })
        .await
        .expect("paused editable");
    assert!(matches!(
        outcome,
        RecurringMutationOutcome::Succeeded { .. }
    ));
}
