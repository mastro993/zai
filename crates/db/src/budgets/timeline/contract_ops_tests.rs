use super::contract_support::{date, insert_budget_row, setup_conn};
use super::{BudgetPeriodTimeline, SourceChange, TimelineInspectEntry, TimelineSelection};
use crate::schema::budget_configurations;
use crate::test_utils::TempDb;
use crate::transactions::models::TransactionRow;
use chrono::Datelike;
use diesel::prelude::*;
use uuid::Uuid;
use zai_core::features::budgets::models::{BudgetCadence, BudgetRolloverMode};

#[test]
fn creation_inspect_is_current_without_writer() {
    let temp_db = TempDb::new();
    let mut conn = setup_conn(&temp_db);
    let now = date(2026, 1, 15);
    insert_budget_row(
        &mut conn,
        "created",
        BudgetCadence::Month,
        BudgetRolloverMode::Off,
        false,
        now,
    )
    .expect("insert");

    let inspect = BudgetPeriodTimeline::inspect(
        &mut conn,
        TimelineSelection::Ids(vec!["created".to_string()]),
        now,
    )
    .expect("inspect");
    assert!(inspect.stale_ids().is_empty());
    assert_eq!(inspect.entries.len(), 1);
    assert!(matches!(
        inspect.entries[0],
        TimelineInspectEntry::Current(_)
    ));
}

#[test]
fn empty_period_paused_budget_catch_up_on_ensure() {
    let temp_db = TempDb::new();
    let mut conn = setup_conn(&temp_db);
    let january = date(2026, 1, 15);
    let march = date(2026, 3, 15);
    insert_budget_row(
        &mut conn,
        "paused",
        BudgetCadence::Month,
        BudgetRolloverMode::Off,
        true,
        january,
    )
    .expect("insert");

    let inspect = BudgetPeriodTimeline::inspect(
        &mut conn,
        TimelineSelection::Ids(vec!["paused".to_string()]),
        march,
    )
    .expect("inspect");
    assert_eq!(inspect.stale_ids(), vec!["paused".to_string()]);

    let (budgets, changes) =
        BudgetPeriodTimeline::ensure_current(&mut conn, &["paused".to_string()], march)
            .expect("ensure");
    assert_eq!(budgets.len(), 1);
    assert!(budgets[0].paused);
    assert_eq!(budgets[0].current_period.start.month(), 3);
    assert_eq!(changes.len(), 1);
    let previous = changes[0]
        .previous_current
        .as_ref()
        .expect("catch-up keeps prior current period");
    assert_eq!(previous.start.month(), 1);
}

#[test]
fn config_replacement_recalculates_current_period() {
    let temp_db = TempDb::new();
    let mut conn = setup_conn(&temp_db);
    let now = date(2026, 1, 15);
    insert_budget_row(
        &mut conn,
        "config",
        BudgetCadence::Month,
        BudgetRolloverMode::Off,
        false,
        now,
    )
    .expect("insert");

    diesel::update(
        budget_configurations::table.filter(budget_configurations::budget_id.eq("config")),
    )
    .set(budget_configurations::base_allowance.eq(5_000))
    .execute(&mut conn)
    .expect("update config");

    let changes = BudgetPeriodTimeline::reconcile(
        &mut conn,
        SourceChange::BudgetConfigured {
            budget_id: "config".to_string(),
        },
        now,
    )
    .expect("reconcile");
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].resulting_current.base_allowance, 5_000);
    assert_eq!(changes[0].resulting_current.effective_allowance, 5_000);
}

#[test]
fn rollover_mode_carries_remaining_allowance_across_periods() {
    let temp_db = TempDb::new();
    let mut conn = setup_conn(&temp_db);
    let january = date(2026, 1, 15);
    let february = date(2026, 2, 15);
    insert_budget_row(
        &mut conn,
        "rollover",
        BudgetCadence::Month,
        BudgetRolloverMode::Cumulative,
        false,
        january,
    )
    .expect("insert");

    diesel::insert_into(crate::schema::transactions::table)
        .values(&TransactionRow {
            id: Uuid::new_v4().to_string(),
            description: None,
            amount: 2_000,
            transaction_date: january,
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
            created_at: january,
            updated_at: january,
            deleted_at: None,
        })
        .execute(&mut conn)
        .expect("transaction");

    let (_, changes) =
        BudgetPeriodTimeline::ensure_current(&mut conn, &["rollover".to_string()], february)
            .expect("advance");
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].resulting_current.effective_allowance, 18_000);
}

#[test]
fn transaction_correction_repairs_suffix() {
    let temp_db = TempDb::new();
    let mut conn = setup_conn(&temp_db);
    let january = date(2026, 1, 15);
    let february = date(2026, 2, 10);
    let march = date(2026, 3, 15);
    insert_budget_row(
        &mut conn,
        "suffix",
        BudgetCadence::Month,
        BudgetRolloverMode::Cumulative,
        false,
        january,
    )
    .expect("insert");

    let tx = TransactionRow {
        id: "tx-1".to_string(),
        description: None,
        amount: 500,
        transaction_date: january,
        transaction_type: "expense".to_string(),
        transaction_category_id: None,
        notes: None,
        created_at: january,
        updated_at: january,
        deleted_at: None,
    };
    diesel::insert_into(crate::schema::transactions::table)
        .values(&tx)
        .execute(&mut conn)
        .expect("insert tx");
    BudgetPeriodTimeline::ensure_current(&mut conn, &["suffix".to_string()], march)
        .expect("catch up");

    let moved = TransactionRow {
        transaction_date: february,
        updated_at: february,
        ..tx.clone()
    };
    diesel::update(crate::schema::transactions::table.find("tx-1"))
        .set((
            crate::schema::transactions::transaction_date.eq(february),
            crate::schema::transactions::updated_at.eq(february),
        ))
        .execute(&mut conn)
        .expect("move transaction in db");
    BudgetPeriodTimeline::reconcile(
        &mut conn,
        SourceChange::Transactions {
            old: vec![tx],
            new: vec![moved],
        },
        march,
    )
    .expect("repair suffix");

    let january_start = chrono::NaiveDate::from_ymd_opt(2026, 1, 1)
        .expect("date")
        .and_hms_opt(0, 0, 0)
        .expect("time");
    let january_spending: i64 = crate::schema::budget_period_results::table
        .filter(crate::schema::budget_period_results::budget_id.eq("suffix"))
        .filter(crate::schema::budget_period_results::period_start.eq(january_start))
        .select(crate::schema::budget_period_results::net_budget_spending)
        .first(&mut conn)
        .expect("january spending");
    assert_eq!(january_spending, 0);
}
