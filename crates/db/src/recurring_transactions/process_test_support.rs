use super::failpoints;
use super::fulfill::FAIL_AFTER_TRANSACTION_INSERT;
use super::seed::{SeedRecurringSource, seed_active_interval_source};
use crate::connection::{create_pool, get_connection, run_migrations};
use crate::schema::{
    domain_alerts, recurring_generation_failures, recurring_occurrence_heads,
    recurring_occurrences, recurring_transactions, transactions,
};
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use chrono::{NaiveDate, NaiveDateTime};
use diesel::prelude::*;
use diesel::sql_types::BigInt;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as AsyncMutex;
use tokio::sync::MutexGuard as AsyncMutexGuard;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::DomainAlertEventBus;
use zai_core::features::recurring_transactions::{
    RECURRING_GENERATION_FAILURE_PRODUCER_KEY, RECURRING_OCCURRENCE_PRODUCER_KEY,
    RecurringOccurrenceProcessor, RecurringTransactionsService,
};

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

    #[allow(dead_code)]
    pub fn set(&self, current: NaiveDateTime) {
        *self.current.lock().expect("clock lock") = current;
    }
}

impl CalendarClock for ManualClock {
    fn sample(&self) -> NaiveDateTime {
        *self.current.lock().expect("clock lock")
    }
}

pub struct LabeledProcessor {
    pub identity: &'static str,
    inner: Arc<dyn RecurringOccurrenceProcessor>,
}

impl LabeledProcessor {
    pub fn new(identity: &'static str, inner: Arc<dyn RecurringOccurrenceProcessor>) -> Self {
        Self { identity, inner }
    }
}

#[async_trait::async_trait]
impl RecurringOccurrenceProcessor for LabeledProcessor {
    async fn process_due(
        &self,
        observed_local: NaiveDateTime,
        work_budget: zai_core::features::recurring_transactions::ProcessingWorkBudget,
        cancelled: Option<&std::sync::atomic::AtomicBool>,
    ) -> zai_core::Result<zai_core::features::recurring_transactions::ProcessingSliceOutcome> {
        self.inner
            .process_due(observed_local, work_budget, cancelled)
            .await
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
    reset_failpoints();
    let temp_db = TempDb::new();
    let (service, repo) = open_service(temp_db.path(), observed);
    (temp_db, service, repo, guard)
}

pub fn open_service(
    db_path: &str,
    observed: NaiveDateTime,
) -> (
    RecurringTransactionsService,
    Arc<super::RecurringTransactionsRepository>,
) {
    open_service_with_options(db_path, observed, true)
}

pub fn open_service_with_options(
    db_path: &str,
    observed: NaiveDateTime,
    run_migrations_on_open: bool,
) -> (
    RecurringTransactionsService,
    Arc<super::RecurringTransactionsRepository>,
) {
    if run_migrations_on_open {
        prepare_sqlite_file(db_path);
    }
    let pool = create_pool(std::path::Path::new(db_path)).expect("pool");
    if run_migrations_on_open {
        run_migrations(&pool).expect("migrations");
    }
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
    (service, repo)
}

fn prepare_sqlite_file(db_path: &str) {
    use diesel::connection::SimpleConnection;
    use diesel::sqlite::SqliteConnection;
    let mut conn = SqliteConnection::establish(db_path).expect("bootstrap conn");
    conn.batch_execute(
        "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 30000;",
    )
    .expect("bootstrap pragmas");
}

/// Two services / writers on one SQLite file (app + future-daemon identities).
pub async fn setup_dual_services(
    observed_app: NaiveDateTime,
    observed_daemon: NaiveDateTime,
) -> (
    TempDb,
    LabeledProcessor,
    LabeledProcessor,
    Arc<super::RecurringTransactionsRepository>,
    Arc<super::RecurringTransactionsRepository>,
    AsyncMutexGuard<'static, ()>,
) {
    let guard = PROCESS_TEST_LOCK.lock().await;
    reset_failpoints();
    let temp_db = TempDb::new();
    let path = temp_db.path().to_string();

    // Prepare + migrate once before either writer attaches.
    {
        prepare_sqlite_file(&path);
        let bootstrap = create_pool(std::path::Path::new(&path)).expect("bootstrap pool");
        run_migrations(&bootstrap).expect("bootstrap migrations");
        drop(bootstrap);
    }

    let (app_service, app_repo) = open_service_with_options(&path, observed_app, false);
    let (daemon_service, daemon_repo) = open_service_with_options(&path, observed_daemon, false);

    let app = LabeledProcessor::new("app", Arc::new(app_service));
    let daemon = LabeledProcessor::new("daemon", Arc::new(daemon_service));
    (temp_db, app, daemon, app_repo, daemon_repo, guard)
}

pub fn reset_failpoints() {
    FAIL_AFTER_TRANSACTION_INSERT.store(false, Ordering::SeqCst);
    failpoints::reset();
    zai_core::features::recurring_transactions::process_failpoints::reset();
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CanonicalFulfillmentCounts {
    pub occurrences: i64,
    pub transactions: i64,
    pub occurrence_alerts: i64,
    pub generation_failures: i64,
    pub heads: i64,
    pub fulfilled_count: i64,
}

pub fn count_canonical(
    repo: &super::RecurringTransactionsRepository,
) -> CanonicalFulfillmentCounts {
    let pool = repo.pool().clone();
    let mut conn = get_connection(&pool).expect("conn");
    let occurrences: i64 = recurring_occurrences::table
        .count()
        .get_result(&mut conn)
        .expect("occurrences");
    let transactions: i64 = transactions::table
        .filter(transactions::deleted_at.is_null())
        .count()
        .get_result(&mut conn)
        .expect("transactions");
    let occurrence_alerts: i64 = domain_alerts::table
        .filter(domain_alerts::producer_key.eq(RECURRING_OCCURRENCE_PRODUCER_KEY))
        .count()
        .get_result(&mut conn)
        .expect("alerts");
    let generation_failures: i64 = recurring_generation_failures::table
        .count()
        .get_result(&mut conn)
        .expect("failures");
    let heads: i64 = recurring_occurrence_heads::table
        .count()
        .get_result(&mut conn)
        .expect("heads");
    let fulfilled_count: i64 = recurring_transactions::table
        .select(diesel::dsl::sql::<BigInt>(
            "COALESCE(SUM(fulfilled_count), 0)",
        ))
        .first(&mut conn)
        .expect("fulfilled");
    CanonicalFulfillmentCounts {
        occurrences,
        transactions,
        occurrence_alerts,
        generation_failures,
        heads,
        fulfilled_count,
    }
}

pub fn assert_canonical_fulfillment(
    repo: &super::RecurringTransactionsRepository,
    expected_occurrences: i64,
) {
    let counts = count_canonical(repo);
    assert_eq!(counts.occurrences, expected_occurrences, "occurrences");
    assert_eq!(counts.transactions, expected_occurrences, "transactions");
    assert_eq!(
        counts.occurrence_alerts, expected_occurrences,
        "occurrence alerts"
    );
    assert_eq!(
        counts.fulfilled_count, expected_occurrences,
        "fulfilled_count sum"
    );
    assert_eq!(counts.generation_failures, 0, "generation failures");
}

pub fn assert_no_generation_failure(repo: &super::RecurringTransactionsRepository) {
    let pool = repo.pool().clone();
    let mut conn = get_connection(&pool).expect("conn");
    let failures: i64 = recurring_generation_failures::table
        .count()
        .get_result(&mut conn)
        .expect("failures");
    assert_eq!(failures, 0);
    let delay_or_failure_alerts: i64 = domain_alerts::table
        .filter(domain_alerts::producer_key.eq(RECURRING_GENERATION_FAILURE_PRODUCER_KEY))
        .count()
        .get_result(&mut conn)
        .expect("failure alerts");
    assert_eq!(delay_or_failure_alerts, 0);
}

pub fn default_seed(id: &str, name: &str, first: NaiveDateTime) -> SeedRecurringSource {
    SeedRecurringSource {
        id: id.into(),
        name: name.into(),
        lifecycle: "active",
        total_occurrences: None,
        fulfilled_count: 0,
        revision: 1,
        first_scheduled_local: first,
        next_scheduled_local: first,
        next_ordinal: 1,
        amount: 100,
        transaction_type: "expense",
    }
}
