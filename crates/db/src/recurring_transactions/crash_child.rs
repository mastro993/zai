use crate::connection::{create_pool, run_migrations};
use crate::write_actor::spawn_writer;
use chrono::NaiveDateTime;
use std::sync::Arc;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::DomainAlertEventBus;
use zai_core::features::recurring_transactions::{
    ProcessingWorkBudget, RecurringOccurrenceProcessor, RecurringTransactionsService,
};

use super::failpoints::{self, FulfillmentFailpoint};
use super::repository::RecurringTransactionsRepository;

struct FixedClock(NaiveDateTime);

impl CalendarClock for FixedClock {
    fn sample(&self) -> NaiveDateTime {
        self.0
    }
}

fn site_from_u8(value: u8) -> FulfillmentFailpoint {
    match value {
        1 => FulfillmentFailpoint::BeforeSideEffects,
        2 => FulfillmentFailpoint::AfterTransactionInsert,
        3 => FulfillmentFailpoint::AfterAlertInsert,
        4 => FulfillmentFailpoint::AfterOccurrenceInsert,
        5 => FulfillmentFailpoint::AfterHeadAdvance,
        6 => FulfillmentFailpoint::AfterBudgetReconcile,
        7 => FulfillmentFailpoint::AfterCommitBeforeReply,
        _ => FulfillmentFailpoint::None,
    }
}

/// Entry point for `recurring-crash-child` subprocess failpoint tests.
pub async fn run_crash_child_from_env() {
    let db = std::env::var("ZAI_RECURRING_CRASH_DB").expect("ZAI_RECURRING_CRASH_DB");
    let observed = NaiveDateTime::parse_from_str(
        &std::env::var("ZAI_RECURRING_CRASH_OBSERVED").expect("ZAI_RECURRING_CRASH_OBSERVED"),
        "%Y-%m-%d %H:%M:%S",
    )
    .expect("parse observed");
    let site = std::env::var("ZAI_RECURRING_CRASH_SITE")
        .ok()
        .and_then(|value| value.parse::<u8>().ok())
        .unwrap_or(0);

    failpoints::reset();
    failpoints::arm_exit(site_from_u8(site));

    let pool = create_pool(std::path::Path::new(&db)).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let clock: Arc<dyn CalendarClock> = Arc::new(FixedClock(observed));
    let repo = Arc::new(
        RecurringTransactionsRepository::new_with_clock_and_publisher(
            Arc::clone(&pool),
            writer,
            Arc::clone(&clock),
            DomainAlertEventBus::new(),
        ),
    );
    let service = RecurringTransactionsService::new(repo as Arc<_>, clock);
    let _ = service
        .process_due(observed, ProcessingWorkBudget::occurrences(1), None)
        .await;
    std::process::exit(2);
}
