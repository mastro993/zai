use super::lifecycle_test_support::{base_seed, lifecycle_update};
use super::process_test_support::{local, seed_source, setup_service};
use crate::connection::get_connection;
use crate::schema::recurring_occurrences;
use diesel::prelude::*;
use zai_core::features::recurring_transactions::{
    RecurringLifecycle, RecurringLifecycleOutcome, RecurringTransactionsServiceTrait,
    UNCHANGED_INVALID_TRANSITION,
};

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
async fn resume_after_backward_clock_does_not_reopen_skipped_slots() {
    let pause_at = local(2026, 3, 1, 10, 0);
    let (_db, service, repo, clock, _lock) = setup_service(pause_at).await;
    seed_source(&repo, base_seed("rt-back", "Backward")).await;

    let paused = service
        .pause(lifecycle_update("rt-back", 1))
        .await
        .expect("pause");
    let paused_doc = match paused {
        RecurringLifecycleOutcome::Succeeded { document } => document,
        other => panic!("expected pause Succeeded, got {other:?}"),
    };
    let head_after_pause = paused_doc
        .occurrence_summary
        .next_scheduled_local
        .expect("head");
    let fulfilled = paused_doc.recurring_transaction.fulfilled_count;

    clock.set(local(2026, 6, 1, 10, 0));
    let resumed_forward = service
        .resume(lifecycle_update(
            "rt-back",
            paused_doc.recurring_transaction.revision,
        ))
        .await
        .expect("resume forward");
    let forward_doc = match resumed_forward {
        RecurringLifecycleOutcome::Succeeded { document } => document,
        other => panic!("expected resume Succeeded, got {other:?}"),
    };
    let head_after_resume = forward_doc
        .occurrence_summary
        .next_scheduled_local
        .expect("head after resume");
    assert!(head_after_resume > local(2026, 6, 1, 10, 0));
    assert_eq!(forward_doc.recurring_transaction.fulfilled_count, fulfilled);

    let paused_again = service
        .pause(lifecycle_update(
            "rt-back",
            forward_doc.recurring_transaction.revision,
        ))
        .await
        .expect("pause again");
    let paused_again_doc = match paused_again {
        RecurringLifecycleOutcome::Succeeded { document } => document,
        other => panic!("expected pause again Succeeded, got {other:?}"),
    };

    clock.set(local(2026, 2, 1, 10, 0));
    let resumed_back = service
        .resume(lifecycle_update(
            "rt-back",
            paused_again_doc.recurring_transaction.revision,
        ))
        .await
        .expect("resume backward");
    let back_doc = match resumed_back {
        RecurringLifecycleOutcome::Succeeded { document } => document,
        other => panic!("expected resume backward Succeeded, got {other:?}"),
    };
    assert_eq!(
        back_doc.occurrence_summary.next_scheduled_local,
        Some(head_after_resume)
    );
    assert_eq!(back_doc.recurring_transaction.fulfilled_count, fulfilled);
    assert!(head_after_resume >= head_after_pause);
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
