use super::contract_support::{date, insert_budget_row, setup_conn};
use super::{BudgetPeriodTimeline, SourceChange, TimelineInspectEntry, TimelineSelection};
use crate::budgets::models::BudgetRow;
use crate::schema::budgets;
use crate::test_utils::TempDb;
use chrono::{Datelike, Duration};
use diesel::prelude::*;
use zai_core::Error;
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetMeasurementMode, BudgetRolloverMode, BudgetStatus,
};

#[test]
fn clock_regression_rejects_inspect_and_ensure() {
    let temp_db = TempDb::new();
    let mut conn = setup_conn(&temp_db);
    let march = date(2026, 3, 15);
    let january = date(2026, 1, 15);
    insert_budget_row(
        &mut conn,
        "clock",
        BudgetCadence::Month,
        BudgetRolloverMode::Off,
        false,
        march,
    )
    .expect("insert");

    let inspect_error = BudgetPeriodTimeline::inspect(
        &mut conn,
        TimelineSelection::Ids(vec!["clock".to_string()]),
        january,
    )
    .expect_err("clock regression on inspect");
    assert!(matches!(
        inspect_error,
        crate::errors::StorageError::CoreError(Error::ClockRegression(_))
    ));

    let ensure_error =
        BudgetPeriodTimeline::ensure_current(&mut conn, &["clock".to_string()], january)
            .expect_err("clock regression on ensure");
    assert!(matches!(
        ensure_error,
        crate::errors::StorageError::CoreError(Error::ClockRegression(_))
    ));
}

#[test]
fn ensure_current_is_idempotent_for_identical_facts() {
    let temp_db = TempDb::new();
    let mut conn = setup_conn(&temp_db);
    let now = date(2026, 1, 15);
    insert_budget_row(
        &mut conn,
        "idem",
        BudgetCadence::Month,
        BudgetRolloverMode::Off,
        false,
        now,
    )
    .expect("insert");

    let first =
        BudgetPeriodTimeline::ensure_current(&mut conn, &["idem".to_string()], now).expect("first");
    let second = BudgetPeriodTimeline::ensure_current(&mut conn, &["idem".to_string()], now)
        .expect("second");
    assert!(first.1.is_empty());
    assert!(second.1.is_empty());
    assert_eq!(
        first.0[0].current_period.remaining_allowance,
        second.0[0].current_period.remaining_allowance
    );
}

#[test]
fn budget_created_reconcile_catches_up_from_row_only() {
    let temp_db = TempDb::new();
    let mut conn = setup_conn(&temp_db);
    let march = date(2026, 3, 15);
    let timestamp = chrono::Utc::now().naive_utc();
    diesel::insert_into(budgets::table)
        .values(&BudgetRow {
            id: "row-only".to_string(),
            name: "Row only".to_string(),
            cadence: BudgetCadence::Month.to_string(),
            measurement_mode: BudgetMeasurementMode::Spending.to_string(),
            base_allowance: 10_000,
            rollover_mode: BudgetRolloverMode::Off.to_string(),
            warning_percentage: Some(80),
            created_at: timestamp,
            updated_at: timestamp,
            deleted_at: None,
            revision: 0,
            paused: false,
        })
        .execute(&mut conn)
        .expect("budget row");

    let changes = BudgetPeriodTimeline::reconcile(
        &mut conn,
        SourceChange::BudgetCreated {
            budget_id: "row-only".to_string(),
            category_ids: Vec::new(),
        },
        march,
    )
    .expect("create reconcile");
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].resulting_current.start.month(), 3);

    let inspect = BudgetPeriodTimeline::inspect(
        &mut conn,
        TimelineSelection::Ids(vec!["row-only".to_string()]),
        march,
    )
    .expect("inspect");
    assert!(inspect.stale_ids().is_empty());
    let TimelineInspectEntry::Current(budget) = inspect.entries[0].clone() else {
        panic!("expected current");
    };
    assert_eq!(budget.current_period.status, BudgetStatus::OnTrack);
}

#[test]
fn period_advance_limit_is_enforced() {
    let temp_db = TempDb::new();
    let mut conn = setup_conn(&temp_db);
    let start = date(2020, 1, 1);
    let target = start + Duration::days(2_001);
    insert_budget_row(
        &mut conn,
        "limit",
        BudgetCadence::Day,
        BudgetRolloverMode::Off,
        false,
        start,
    )
    .expect("insert");

    let error = BudgetPeriodTimeline::ensure_current(&mut conn, &["limit".to_string()], target)
        .expect_err("limit");
    assert!(matches!(
        error,
        crate::errors::StorageError::CoreError(Error::PeriodAdvanceLimitExceeded(_))
    ));
}
