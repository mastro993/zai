use super::fulfill::FAIL_AFTER_TRANSACTION_INSERT;
use super::seed::{SeedRecurringSource, seed_active_interval_source};
use crate::connection::{create_pool, run_migrations};
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use chrono::{NaiveDate, NaiveDateTime};
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as AsyncMutex;
use tokio::sync::MutexGuard as AsyncMutexGuard;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::DomainAlertEventBus;
use zai_core::features::recurring_transactions::RecurringTransactionsService;

pub static PROCESS_TEST_LOCK: AsyncMutex<()> = AsyncMutex::const_new(());

pub struct ManualClock {
    current: Mutex<NaiveDateTime>,
}

impl ManualClock {
    pub fn new(current: NaiveDateTime) -> Self {
        Self {
            current: Mutex::new(current),
        }
    }
}

impl CalendarClock for ManualClock {
    fn sample(&self) -> NaiveDateTime {
        *self.current.lock().expect("clock lock")
    }
}

pub fn local(year: i32, month: u32, day: u32, hour: u32, minute: u32) -> NaiveDateTime {
    NaiveDate::from_ymd_opt(year, month, day)
        .expect("date")
        .and_hms_opt(hour, minute, 0)
        .expect("time")
}

pub async fn setup_service(
    observed: NaiveDateTime,
) -> (
    TempDb,
    RecurringTransactionsService,
    Arc<super::RecurringTransactionsRepository>,
    AsyncMutexGuard<'static, ()>,
) {
    let guard = PROCESS_TEST_LOCK.lock().await;
    FAIL_AFTER_TRANSACTION_INSERT.store(false, Ordering::SeqCst);
    let temp_db = TempDb::new();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let clock: Arc<dyn CalendarClock> = Arc::new(ManualClock::new(observed));
    let bus = DomainAlertEventBus::new();
    let repo = Arc::new(
        super::RecurringTransactionsRepository::new_with_clock_and_publisher(
            Arc::clone(&pool),
            writer,
            Arc::clone(&clock),
            bus,
        ),
    );
    let service = RecurringTransactionsService::new(Arc::clone(&repo) as Arc<_>, clock);
    (temp_db, service, repo, guard)
}

pub async fn seed_source(
    repo: &super::RecurringTransactionsRepository,
    seed: SeedRecurringSource,
) -> (String, String) {
    let writer = repo.writer().clone();
    writer
        .exec(move |conn| seed_active_interval_source(conn, &seed))
        .await
        .expect("seed")
}
