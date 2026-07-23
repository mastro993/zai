use crate::features::budgets::traits::CalendarClock;
use crate::features::recurring_transactions::{
    ProcessingSliceOutcome, ProcessingStopReason, ProcessingWorkBudget,
    RecurringOccurrenceProcessor, RecurringProcessDelayAlerts, RecurringProcessingEvent,
    RecurringProcessingEventBus, RecurringProcessingFinishState, RecurringProcessingStatus,
    RecurringProcessingSupervisor, RecurringSupervisorHeads, TRANSIENT_DELAY_REARM,
    WAKE_COALESCE_WINDOW, deserialize_recurring_processing_event,
};
use crate::{Error, Result};
use async_trait::async_trait;
use chrono::{NaiveDate, NaiveDateTime};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Default)]
struct ManualClock {
    sample: Mutex<Option<NaiveDateTime>>,
}

impl ManualClock {
    fn new(value: NaiveDateTime) -> Self {
        Self {
            sample: Mutex::new(Some(value)),
        }
    }
}

impl CalendarClock for ManualClock {
    fn sample(&self) -> NaiveDateTime {
        self.sample
            .lock()
            .expect("clock")
            .unwrap_or_else(|| local(2026, 1, 1, 9, 0))
    }
}

struct ScriptedProcessor {
    outcomes: Mutex<Vec<ProcessingSliceOutcome>>,
    calls: AtomicU32,
    failures: AtomicU32,
}

#[async_trait]
impl RecurringOccurrenceProcessor for ScriptedProcessor {
    async fn process_due(
        &self,
        _observed_local: NaiveDateTime,
        _work_budget: ProcessingWorkBudget,
        cancelled: Option<&AtomicBool>,
    ) -> Result<ProcessingSliceOutcome> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        if cancelled.is_some_and(|flag| flag.load(Ordering::SeqCst)) {
            return Ok(ProcessingSliceOutcome {
                committed: 0,
                already_fulfilled: 0,
                more_due_remaining: true,
                stop_reason: ProcessingStopReason::Cancelled,
                observed_local: local(2026, 1, 1, 9, 0),
            });
        }
        if consume_failure(&self.failures) {
            return Err(Error::Repository("injected processor failure".to_string()));
        }
        Ok(self
            .outcomes
            .lock()
            .expect("outcomes")
            .pop()
            .unwrap_or_else(caught_up))
    }
}

#[derive(Default)]
struct Heads {
    next: Mutex<Option<NaiveDateTime>>,
    failures: AtomicU32,
}

#[async_trait]
impl RecurringSupervisorHeads for Heads {
    async fn earliest_active_head_after(
        &self,
        _after_local: NaiveDateTime,
    ) -> Result<Option<NaiveDateTime>> {
        if consume_failure(&self.failures) {
            return Err(Error::Repository(
                "injected head lookup failure".to_string(),
            ));
        }
        Ok(*self.next.lock().expect("heads"))
    }
}

#[derive(Default)]
struct DelayAlerts {
    ensured: AtomicU32,
    resolved: AtomicU32,
    ensure_failures: AtomicU32,
    resolve_failures: AtomicU32,
}

#[async_trait]
impl RecurringProcessDelayAlerts for DelayAlerts {
    async fn ensure_delayed(&self) -> Result<()> {
        self.ensured.fetch_add(1, Ordering::SeqCst);
        if consume_failure(&self.ensure_failures) {
            return Err(Error::Repository(
                "injected alert ensure failure".to_string(),
            ));
        }
        Ok(())
    }

    async fn resolve_delayed(&self) -> Result<()> {
        self.resolved.fetch_add(1, Ordering::SeqCst);
        if consume_failure(&self.resolve_failures) {
            return Err(Error::Repository(
                "injected alert resolve failure".to_string(),
            ));
        }
        Ok(())
    }
}

fn local(y: i32, m: u32, d: u32, h: u32, min: u32) -> NaiveDateTime {
    NaiveDate::from_ymd_opt(y, m, d)
        .unwrap()
        .and_hms_opt(h, min, 0)
        .unwrap()
}

fn caught_up() -> ProcessingSliceOutcome {
    ProcessingSliceOutcome {
        committed: 0,
        already_fulfilled: 0,
        more_due_remaining: false,
        stop_reason: ProcessingStopReason::CaughtUp,
        observed_local: local(2026, 1, 1, 9, 0),
    }
}

fn budget_exhausted() -> ProcessingSliceOutcome {
    ProcessingSliceOutcome {
        committed: 1,
        already_fulfilled: 0,
        more_due_remaining: true,
        stop_reason: ProcessingStopReason::BudgetExhausted,
        observed_local: local(2026, 1, 1, 9, 0),
    }
}

fn consume_failure(counter: &AtomicU32) -> bool {
    counter
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |remaining| {
            if remaining == 0 {
                None
            } else {
                Some(remaining - 1)
            }
        })
        .is_ok()
}

#[tokio::test(start_paused = true)]
async fn processor_error_creates_delay_state_and_retries_after_rearm() {
    let bus = RecurringProcessingEventBus::with_capacity(16);
    let mut receiver = bus.subscribe();
    let processor = Arc::new(ScriptedProcessor {
        outcomes: Mutex::new(vec![caught_up()]),
        calls: AtomicU32::new(0),
        failures: AtomicU32::new(1),
    });
    let delay = Arc::new(DelayAlerts::default());
    let supervisor = RecurringProcessingSupervisor::new(
        processor.clone(),
        Arc::new(ManualClock::new(local(2026, 1, 1, 9, 0))),
        Arc::new(Heads::default()),
        bus,
        delay.clone(),
    );
    let handle = supervisor.spawn();

    advance(WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;
    assert_eq!(
        receive_finished_state(&mut receiver).await,
        RecurringProcessingFinishState::TransientlyDelayed
    );
    assert_eq!(processor.calls.load(Ordering::SeqCst), 1);
    assert_eq!(delay.ensured.load(Ordering::SeqCst), 1);
    assert_eq!(handle.status(), RecurringProcessingStatus::Delayed);

    advance(TRANSIENT_DELAY_REARM + WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;
    assert_eq!(
        receive_finished_state(&mut receiver).await,
        RecurringProcessingFinishState::CaughtUp
    );
    assert_eq!(processor.calls.load(Ordering::SeqCst), 2);
    assert_eq!(delay.resolved.load(Ordering::SeqCst), 1);
    handle.request_shutdown();
}

#[tokio::test(start_paused = true)]
async fn failed_delay_alert_is_retried_before_processing_recovery() {
    let bus = RecurringProcessingEventBus::with_capacity(16);
    let mut receiver = bus.subscribe();
    let processor = Arc::new(ScriptedProcessor {
        outcomes: Mutex::new(vec![caught_up()]),
        calls: AtomicU32::new(0),
        failures: AtomicU32::new(1),
    });
    let delay = Arc::new(DelayAlerts {
        ensure_failures: AtomicU32::new(1),
        ..DelayAlerts::default()
    });
    let supervisor = RecurringProcessingSupervisor::new(
        processor.clone(),
        Arc::new(ManualClock::new(local(2026, 1, 1, 9, 0))),
        Arc::new(Heads::default()),
        bus,
        delay.clone(),
    );
    let handle = supervisor.spawn();

    advance(WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;
    assert_eq!(
        receive_finished_state(&mut receiver).await,
        RecurringProcessingFinishState::TransientlyDelayed
    );
    assert_eq!(processor.calls.load(Ordering::SeqCst), 1);

    advance(TRANSIENT_DELAY_REARM + WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;
    assert_eq!(
        receive_finished_state(&mut receiver).await,
        RecurringProcessingFinishState::CaughtUp
    );
    assert_eq!(processor.calls.load(Ordering::SeqCst), 2);
    assert_eq!(delay.ensured.load(Ordering::SeqCst), 2);
    handle.request_shutdown();
}

#[tokio::test(start_paused = true)]
async fn failed_delay_resolution_keeps_supervisor_delayed_until_recovery() {
    let bus = RecurringProcessingEventBus::with_capacity(16);
    let mut receiver = bus.subscribe();
    let processor = Arc::new(ScriptedProcessor {
        outcomes: Mutex::new(vec![caught_up()]),
        calls: AtomicU32::new(0),
        failures: AtomicU32::new(0),
    });
    let delay = Arc::new(DelayAlerts {
        resolve_failures: AtomicU32::new(1),
        ..DelayAlerts::default()
    });
    let supervisor = RecurringProcessingSupervisor::new(
        processor.clone(),
        Arc::new(ManualClock::new(local(2026, 1, 1, 9, 0))),
        Arc::new(Heads::default()),
        bus,
        delay.clone(),
    );
    let handle = supervisor.spawn();

    advance(WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;
    assert_eq!(
        receive_finished_state(&mut receiver).await,
        RecurringProcessingFinishState::TransientlyDelayed
    );
    assert_eq!(handle.status(), RecurringProcessingStatus::Delayed);

    advance(TRANSIENT_DELAY_REARM + WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;
    assert_eq!(
        receive_finished_state(&mut receiver).await,
        RecurringProcessingFinishState::CaughtUp
    );
    assert_eq!(processor.calls.load(Ordering::SeqCst), 2);
    assert_eq!(delay.resolved.load(Ordering::SeqCst), 2);
    handle.request_shutdown();
}

#[tokio::test(start_paused = true)]
async fn head_lookup_failure_uses_short_recovery_rearm_and_durable_delay() {
    let bus = RecurringProcessingEventBus::with_capacity(16);
    let mut receiver = bus.subscribe();
    let heads = Arc::new(Heads {
        failures: AtomicU32::new(1),
        ..Heads::default()
    });
    let delay = Arc::new(DelayAlerts::default());
    let supervisor = RecurringProcessingSupervisor::new(
        Arc::new(ScriptedProcessor {
            outcomes: Mutex::new(vec![caught_up()]),
            calls: AtomicU32::new(0),
            failures: AtomicU32::new(0),
        }),
        Arc::new(ManualClock::new(local(2026, 1, 1, 9, 0))),
        heads,
        bus,
        delay.clone(),
    );
    let handle = supervisor.spawn();

    advance(WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;
    assert_eq!(
        receive_finished_state(&mut receiver).await,
        RecurringProcessingFinishState::CaughtUp
    );
    assert_eq!(handle.status(), RecurringProcessingStatus::Delayed);
    assert_eq!(delay.ensured.load(Ordering::SeqCst), 1);
    handle.request_shutdown();
}

#[tokio::test(start_paused = true)]
async fn bounded_slice_rearms_timer_before_continuing_backlog() {
    let bus = RecurringProcessingEventBus::with_capacity(16);
    let mut receiver = bus.subscribe();
    let observed = local(2026, 1, 1, 9, 0);
    let heads = Arc::new(Heads {
        next: Mutex::new(Some(local(2026, 1, 1, 10, 0))),
        ..Heads::default()
    });
    let processor = Arc::new(ScriptedProcessor {
        outcomes: Mutex::new(vec![caught_up(), budget_exhausted()]),
        calls: AtomicU32::new(0),
        failures: AtomicU32::new(0),
    });
    let supervisor = RecurringProcessingSupervisor::new(
        processor.clone(),
        Arc::new(ManualClock::new(observed)),
        heads,
        bus,
        Arc::new(DelayAlerts::default()),
    );
    let handle = supervisor.spawn();

    advance(WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;
    assert_eq!(
        receive_finished_state(&mut receiver).await,
        RecurringProcessingFinishState::BudgetExhausted
    );
    assert_eq!(processor.calls.load(Ordering::SeqCst), 1);

    advance(Duration::from_millis(1) + WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;
    assert_eq!(
        receive_finished_state(&mut receiver).await,
        RecurringProcessingFinishState::CaughtUp
    );
    assert_eq!(processor.calls.load(Ordering::SeqCst), 2);
    handle.request_shutdown();
}

async fn advance(duration: Duration) {
    tokio::time::advance(duration).await;
    tokio::task::yield_now().await;
}

async fn receive_finished_state(
    receiver: &mut tokio::sync::broadcast::Receiver<String>,
) -> RecurringProcessingFinishState {
    loop {
        let payload = receiver.recv().await.expect("event");
        let event = deserialize_recurring_processing_event(&payload).expect("decode");
        if let RecurringProcessingEvent::Finished { state, .. } = event {
            return state;
        }
    }
}
