use super::*;
use crate::features::recurring_transactions::{
    MAX_FEED_SEARCH_LENGTH, RecurringFeedFilters, ScheduleIntervalUnit, ScheduleRule,
};
use chrono::NaiveDate;

fn monthly() -> ScheduleRule {
    ScheduleRule::Interval {
        every: 1,
        unit: ScheduleIntervalUnit::Month,
    }
}

fn observed() -> NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 3, 15)
        .unwrap()
        .and_hms_opt(10, 0, 0)
        .unwrap()
}

#[test]
fn rejects_more_than_500_identities() {
    let items = (0..501)
        .map(|index| RecurringBulkItem {
            recurring_transaction_id: format!("rt-{index}"),
            expected_revision: 1,
        })
        .collect();
    let request = RecurringBulkRequest {
        action: RecurringBulkAction::Pause,
        items,
    };
    let error = request.validate_bound().expect_err("over limit");
    assert!(error.to_string().contains("500"));
}

#[test]
fn rejects_duplicate_identities() {
    let request = RecurringBulkRequest {
        action: RecurringBulkAction::Pause,
        items: vec![bulk_item("rt-duplicate"), bulk_item("rt-duplicate")],
    };

    let error = request.validate_bound().expect_err("duplicate identity");
    assert!(error.to_string().contains("duplicate"));
}

fn bulk_item(id: &str) -> RecurringBulkItem {
    RecurringBulkItem {
        recurring_transaction_id: id.to_string(),
        expected_revision: 1,
    }
}

#[test]
fn pause_eligible_only_for_active_unblocked() {
    assert_eq!(
        classify_lifecycle_eligibility(
            RecurringLifecycle::Active,
            false,
            RecurringLifecycleCommand::Pause
        ),
        BulkEligibility::Eligible
    );
    assert!(matches!(
        classify_lifecycle_eligibility(
            RecurringLifecycle::Paused,
            false,
            RecurringLifecycleCommand::Pause
        ),
        BulkEligibility::Unchanged {
            reason: UNCHANGED_INVALID_TRANSITION,
            ..
        }
    ));
    assert!(matches!(
        classify_lifecycle_eligibility(
            RecurringLifecycle::Active,
            true,
            RecurringLifecycleCommand::Pause
        ),
        BulkEligibility::Unchanged {
            reason: UNCHANGED_GENERATION_BLOCKED,
            next_action: Some(NEXT_ACTION_REPAIR),
        }
    ));
}

#[test]
fn retry_excludes_repair_required() {
    assert_eq!(
        classify_retry_eligibility(true, None),
        BulkEligibility::Eligible
    );
    assert!(matches!(
        classify_retry_eligibility(true, Some(RecurringRepairField::TransactionCategoryId),),
        BulkEligibility::Unchanged {
            reason: UNCHANGED_REPAIR_REQUIRED,
            next_action: Some(NEXT_ACTION_REPAIR),
        }
    ));
    assert!(matches!(
        classify_retry_eligibility(false, None),
        BulkEligibility::Unchanged {
            reason: UNCHANGED_NO_OPEN_FAILURE,
            ..
        }
    ));
}

#[test]
fn due_from_head_counts_through_observation() {
    let first = NaiveDate::from_ymd_opt(2026, 1, 1)
        .unwrap()
        .and_hms_opt(9, 0, 0)
        .unwrap();
    let count = count_due_from_head(&monthly(), first, 1, Some(12), observed()).unwrap();
    assert_eq!(count, 3);
}

#[test]
fn feed_filter_fingerprint_ignores_search_whitespace_and_case() {
    let first = RecurringFeedFilters {
        search: Some("  Rent  ".to_string()),
        ..Default::default()
    }
    .normalized()
    .unwrap();
    let second = RecurringFeedFilters {
        search: Some("rent".to_string()),
        ..Default::default()
    }
    .normalized()
    .unwrap();

    assert_eq!(first, second);
    assert_eq!(first.fingerprint(), second.fingerprint());
}

#[test]
fn feed_filter_rejects_unbounded_search() {
    let filters = RecurringFeedFilters {
        search: Some("x".repeat(MAX_FEED_SEARCH_LENGTH + 1)),
        ..Default::default()
    };

    assert!(filters.normalized().is_err());
}
