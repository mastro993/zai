use super::lifecycle_test_support::{base_seed, lifecycle_update, update_from_document};
use super::process_test_support::{local, seed_source, setup_service};
use crate::connection::get_connection;
use crate::schema::{
    recurring_generation_failures, recurring_occurrence_heads, recurring_occurrences,
    recurring_transactions,
};
use diesel::prelude::*;
use diesel::sql_types::BigInt;
use zai_core::features::recurring_transactions::{
    RecurringLifecycle, RecurringLifecycleOutcome, RecurringMutationOutcome,
    RecurringTransactionsServiceTrait, ScheduleIntervalUnit, ScheduleRule,
    UNCHANGED_GENERATION_BLOCKED,
};

#[tokio::test]
async fn delete_retains_history_and_hides_document() {
    let observed = local(2026, 2, 1, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-tomb", "Tomb me")).await;

    let deleted = service
        .delete(lifecycle_update("rt-tomb", 1))
        .await
        .expect("delete");
    match deleted {
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
async fn delete_from_stopped_retains_occurrences() {
    let observed = local(2026, 2, 1, 10, 0);
    let (_db, service, repo, _clock, _lock) = setup_service(observed).await;
    seed_source(&repo, base_seed("rt-stop-tomb", "Stop then tomb")).await;

    let stopped = service
        .stop(lifecycle_update("rt-stop-tomb", 1))
        .await
        .expect("stop");
    let stopped_doc = match stopped {
        RecurringLifecycleOutcome::Succeeded { document } => document,
        other => panic!("expected stop Succeeded, got {other:?}"),
    };
    let fulfilled = stopped_doc.recurring_transaction.fulfilled_count;
    assert!(fulfilled >= 1);

    let deleted = service
        .delete(lifecycle_update(
            "rt-stop-tomb",
            stopped_doc.recurring_transaction.revision,
        ))
        .await
        .expect("delete");
    match deleted {
        RecurringLifecycleOutcome::Succeeded { document } => {
            assert_eq!(
                document.recurring_transaction.lifecycle,
                RecurringLifecycle::Tombstoned
            );
        }
        other => panic!("expected delete Succeeded, got {other:?}"),
    }

    let mut conn = get_connection(repo.pool()).expect("conn");
    let occurrence_count: i64 = recurring_occurrences::table
        .filter(recurring_occurrences::recurring_transaction_id.eq("rt-stop-tomb"))
        .count()
        .get_result(&mut conn)
        .expect("count");
    assert_eq!(occurrence_count, i64::from(fulfilled));
    let schedules: i64 = diesel::sql_query(
        "SELECT COUNT(*) AS value FROM recurring_schedule_revisions WHERE recurring_transaction_id = 'rt-stop-tomb'",
    )
    .get_result::<CountRow>(&mut conn)
    .expect("schedules")
    .value;
    assert_eq!(schedules, 1);
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

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = BigInt)]
    value: i64,
}
