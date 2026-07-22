use super::process_test_support::{local, seed_source, setup_service};
use super::seed::SeedRecurringSource;
use crate::connection::get_connection;
use crate::schema::{
    recurring_generation_failures, recurring_occurrence_heads, recurring_occurrences,
    recurring_transactions,
};
use diesel::prelude::*;
use zai_core::features::recurring_transactions::{
    RecurringLifecycle, RecurringLifecycleOutcome, RecurringLifecycleUpdate,
    RecurringMutationOutcome, RecurringTemplateInput, RecurringTransactionDocument,
    RecurringTransactionsServiceTrait, ScheduleIntervalUnit, ScheduleRule,
    UNCHANGED_GENERATION_BLOCKED, UNCHANGED_INVALID_TRANSITION, UpdateRecurringTransaction,
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

fn lifecycle_update(id: &str, revision: i32) -> RecurringLifecycleUpdate {
    RecurringLifecycleUpdate {
        recurring_transaction_id: id.into(),
        expected_revision: revision,
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
async fn pause_catches_up_then_commits_without_consuming_extra_count() {
    let observed = local(2026, 3, 15, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-pause", "Pause me")).await;

    let outcome = service
        .pause(lifecycle_update("rt-pause", 1))
        .await
        .expect("pause");
    let document = match outcome {
        RecurringLifecycleOutcome::Succeeded { document } => document,
        other => panic!("expected Succeeded, got {other:?}"),
    };
    assert_eq!(
        document.recurring_transaction.lifecycle,
        RecurringLifecycle::Paused
    );
    assert!(document.recurring_transaction.paused_at.is_some());
    assert!(document.recurring_transaction.fulfilled_count >= 1);
    assert!(
        document
            .occurrence_summary
            .next_scheduled_local
            .is_some_and(|next| next > observed)
    );

    let mut conn = get_connection(repo.pool()).expect("conn");
    let occurrence_count: i64 = recurring_occurrences::table
        .filter(recurring_occurrences::recurring_transaction_id.eq("rt-pause"))
        .count()
        .get_result(&mut conn)
        .expect("count");
    assert_eq!(
        occurrence_count,
        i64::from(document.recurring_transaction.fulfilled_count)
    );
}

#[tokio::test]
async fn resume_skips_due_while_paused_without_backfill() {
    let pause_at = local(2026, 1, 15, 10, 0);
    let (_db, service, repo, clock, _lock) = setup_service(pause_at).await;
    let mut seed = base_seed("rt-resume", "Resume me");
    seed.first_scheduled_local = local(2026, 1, 1, 9, 0);
    seed.next_scheduled_local = local(2026, 1, 1, 9, 0);
    seed_source(&repo, seed).await;

    let paused = service
        .pause(lifecycle_update("rt-resume", 1))
        .await
        .expect("pause");
    let paused_doc = match paused {
        RecurringLifecycleOutcome::Succeeded { document } => document,
        other => panic!("expected pause Succeeded, got {other:?}"),
    };
    let fulfilled_at_pause = paused_doc.recurring_transaction.fulfilled_count;
    let head_at_pause = paused_doc.occurrence_summary.next_scheduled_local;

    let resume_at = local(2026, 4, 1, 10, 0);
    clock.set(resume_at);
    let resumed = service
        .resume(lifecycle_update(
            "rt-resume",
            paused_doc.recurring_transaction.revision,
        ))
        .await
        .expect("resume");
    let resumed_doc = match resumed {
        RecurringLifecycleOutcome::Succeeded { document } => document,
        other => panic!("expected resume Succeeded, got {other:?}"),
    };
    assert_eq!(
        resumed_doc.recurring_transaction.lifecycle,
        RecurringLifecycle::Active
    );
    assert_eq!(
        resumed_doc.recurring_transaction.fulfilled_count,
        fulfilled_at_pause
    );
    assert!(
        resumed_doc
            .occurrence_summary
            .next_scheduled_local
            .is_some_and(|next| next > resume_at)
    );
    assert_ne!(
        resumed_doc.occurrence_summary.next_scheduled_local,
        head_at_pause
    );

    let mut conn = get_connection(repo.pool()).expect("conn");
    let occurrence_count: i64 = recurring_occurrences::table
        .filter(recurring_occurrences::recurring_transaction_id.eq("rt-resume"))
        .count()
        .get_result(&mut conn)
        .expect("count");
    assert_eq!(occurrence_count, i64::from(fulfilled_at_pause));
}

#[tokio::test]
async fn stop_is_irreversible_and_blocks_resume() {
    let observed = local(2026, 2, 1, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-stop", "Stop me")).await;

    let stopped = service
        .stop(lifecycle_update("rt-stop", 1))
        .await
        .expect("stop");
    let stopped_doc = match stopped {
        RecurringLifecycleOutcome::Succeeded { document } => document,
        other => panic!("expected Succeeded, got {other:?}"),
    };
    assert_eq!(
        stopped_doc.recurring_transaction.lifecycle,
        RecurringLifecycle::Stopped
    );
    assert!(stopped_doc.head.is_none());

    let rejected = service
        .resume(lifecycle_update(
            "rt-stop",
            stopped_doc.recurring_transaction.revision,
        ))
        .await
        .expect("resume rejected");
    match rejected {
        RecurringLifecycleOutcome::Unchanged { reason, .. } => {
            assert_eq!(reason, UNCHANGED_INVALID_TRANSITION);
        }
        other => panic!("expected Unchanged, got {other:?}"),
    }
}

#[tokio::test]
async fn tombstone_retains_history_and_hides_document() {
    let observed = local(2026, 2, 1, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-tomb", "Tomb me")).await;

    let tombstoned = service
        .tombstone(lifecycle_update("rt-tomb", 1))
        .await
        .expect("tombstone");
    match tombstoned {
        RecurringLifecycleOutcome::Succeeded { document } => {
            assert_eq!(
                document.recurring_transaction.lifecycle,
                RecurringLifecycle::Tombstoned
            );
            assert!(document.recurring_transaction.deleted_at.is_some());
        }
        other => panic!("expected Succeeded, got {other:?}"),
    }

    let missing = service.get_document("rt-tomb").await;
    assert!(missing.is_err());

    let mut conn = get_connection(repo.pool()).expect("conn");
    let retained: i64 = recurring_transactions::table
        .filter(recurring_transactions::id.eq("rt-tomb"))
        .count()
        .get_result(&mut conn)
        .expect("retained");
    assert_eq!(retained, 1);
    let heads: i64 = recurring_occurrence_heads::table
        .filter(recurring_occurrence_heads::recurring_transaction_id.eq("rt-tomb"))
        .count()
        .get_result(&mut conn)
        .expect("heads");
    assert_eq!(heads, 0);
}

#[tokio::test]
async fn lifecycle_blocked_when_generation_failure_open() {
    let observed = local(2026, 2, 1, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let (schedule_id, _) = seed_source(&repo, base_seed("rt-block", "Blocked")).await;

    let writer = repo.writer().clone();
    let schedule_id_clone = schedule_id.clone();
    writer
        .exec(move |conn| {
            diesel::sql_query(
                "INSERT INTO domain_alerts (id, producer_key, occurrence_key, severity, title, body, created_at, updated_at) \
                 VALUES ('alert-block', 'recurring.generation_failure', 'rt-block|sched|1', 'critical', 'Blocked', 'Needs repair', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            )
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            diesel::insert_into(recurring_generation_failures::table)
                .values((
                    recurring_generation_failures::recurring_transaction_id.eq("rt-block"),
                    recurring_generation_failures::schedule_revision_id.eq(&schedule_id_clone),
                    recurring_generation_failures::ordinal.eq(1),
                    recurring_generation_failures::error_code.eq("invalid_category"),
                    recurring_generation_failures::cause_category.eq("template"),
                    recurring_generation_failures::correlation_id.eq("corr-1"),
                    recurring_generation_failures::failed_scheduled_local
                        .eq(local(2026, 1, 1, 9, 0)),
                    recurring_generation_failures::first_failed_at.eq(observed),
                    recurring_generation_failures::last_failed_at.eq(observed),
                    recurring_generation_failures::attempt_count.eq(1),
                    recurring_generation_failures::generation_failure_alert_id.eq("alert-block"),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("seed failure");

    let outcome = service
        .pause(lifecycle_update("rt-block", 1))
        .await
        .expect("pause blocked");
    match outcome {
        RecurringLifecycleOutcome::Unchanged { reason, document } => {
            assert_eq!(reason, UNCHANGED_GENERATION_BLOCKED);
            assert_eq!(
                document.recurring_transaction.lifecycle,
                RecurringLifecycle::Active
            );
        }
        other => panic!("expected Unchanged generation_blocked, got {other:?}"),
    }
}

#[tokio::test]
async fn stopped_source_allows_description_rename_only() {
    let observed = local(2026, 2, 1, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    let mut seed = base_seed("rt-rename", "Old name");
    seed.lifecycle = "stopped";
    seed_source(&repo, seed).await;
    let before = service.get_document("rt-rename").await.expect("doc");

    let mut rename = update_from_document(&before);
    rename.template.description = "Clarified name".into();
    let renamed = service.update(rename).await.expect("rename");
    match renamed {
        RecurringMutationOutcome::Succeeded { document } => {
            assert_eq!(document.template.description, "Clarified name");
        }
        other => panic!("expected Succeeded rename, got {other:?}"),
    }

    let after = service.get_document("rt-rename").await.expect("after");
    let mut schedule = update_from_document(&after);
    schedule.schedule = ScheduleRule::Interval {
        every: 2,
        unit: ScheduleIntervalUnit::Week,
    };
    let blocked = service.update(schedule).await.expect("schedule blocked");
    assert!(matches!(
        blocked,
        RecurringMutationOutcome::Unchanged { .. }
    ));
}
