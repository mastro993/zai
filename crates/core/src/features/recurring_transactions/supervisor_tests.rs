use crate::features::budgets::traits::CalendarClock;
use crate::features::recurring_transactions::{
    ProcessingSliceOutcome, ProcessingStopReason, ProcessingWorkBudget,
    RecurringOccurrenceProcessor, RecurringProcessDelayAlerts, RecurringProcessingEvent,
    RecurringProcessingEventBus, RecurringProcessingFinishState, RecurringProcessingStatus,
    RecurringProcessingSupervisor, RecurringSupervisorHeads, WAKE_COALESCE_WINDOW,
    deserialize_recurring_processing_event,
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
        let mut guard = self.outcomes.lock().expect("outcomes");
        Ok(guard.pop().unwrap_or(caught_up()))
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
async fn startup_run_publishes_started_and_finished_without_client() {
    let bus = RecurringProcessingEventBus::with_capacity(16);
    let mut receiver = bus.subscribe();
    let processor = Arc::new(ScriptedProcessor {
        outcomes: Mutex::new(vec![ProcessingSliceOutcome {
            committed: 1,
            already_fulfilled: 0,
            more_due_remaining: false,
            stop_reason: ProcessingStopReason::CaughtUp,
            observed_local: local(2026, 1, 1, 9, 0),
        }]),
        calls: AtomicU32::new(0),
        failures: AtomicU32::new(0),
    });
    let delay = Arc::new(DelayAlerts::default());
    let supervisor = RecurringProcessingSupervisor::new(
        processor.clone(),
        Arc::new(ManualClock::new(local(2026, 1, 1, 9, 0))),
        Arc::new(Heads::default()),
        bus.clone(),
        delay.clone(),
    );
    let handle = supervisor.spawn();
    advance(WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;

    let started = receiver.recv().await.expect("started");
    let started = deserialize_recurring_processing_event(&started).expect("decode");
    assert!(matches!(started, RecurringProcessingEvent::Started { .. }));

    let progress = receiver.recv().await.expect("progress");
    let progress = deserialize_recurring_processing_event(&progress).expect("decode");
    assert!(matches!(
        progress,
        RecurringProcessingEvent::Progress { committed: 1, .. }
    ));

    let finished = receiver.recv().await.expect("finished");
    let finished = deserialize_recurring_processing_event(&finished).expect("decode");
    assert!(matches!(
        finished,
        RecurringProcessingEvent::Finished {
            state: RecurringProcessingFinishState::CaughtUp,
            committed: 1,
            ..
        }
    ));
    assert_eq!(processor.calls.load(Ordering::SeqCst), 1);
    assert_eq!(delay.resolved.load(Ordering::SeqCst), 1);
    handle.request_shutdown();
}

#[tokio::test(start_paused = true)]
async fn wake_after_idle_run_starts_processing_without_waiting_for_next_clock_tick() {
    let bus = RecurringProcessingEventBus::with_capacity(16);
    let mut receiver = bus.subscribe();
    let processor = Arc::new(ScriptedProcessor {
        outcomes: Mutex::new(vec![caught_up(), caught_up()]),
        calls: AtomicU32::new(0),
        failures: AtomicU32::new(0),
    });
    let supervisor = RecurringProcessingSupervisor::new(
        processor.clone(),
        Arc::new(ManualClock::new(local(2026, 1, 1, 9, 0))),
        Arc::new(Heads::default()),
        bus,
        Arc::new(DelayAlerts::default()),
    );
    let handle = supervisor.spawn();
    advance(WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;
    receive_finished(&mut receiver).await;
    tokio::task::yield_now().await;

    handle.request_wake();
    advance(WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;
    receive_finished(&mut receiver).await;

    assert_eq!(processor.calls.load(Ordering::SeqCst), 2);
    handle.request_shutdown();
}

#[tokio::test(start_paused = true)]
async fn redundant_wakes_coalesce_within_window() {
    let bus = RecurringProcessingEventBus::with_capacity(16);
    let mut receiver = bus.subscribe();
    let processor = Arc::new(ScriptedProcessor {
        outcomes: Mutex::new(vec![caught_up(), caught_up()]),
        calls: AtomicU32::new(0),
        failures: AtomicU32::new(0),
    });
    let supervisor = RecurringProcessingSupervisor::new(
        processor.clone(),
        Arc::new(ManualClock::new(local(2026, 1, 1, 9, 0))),
        Arc::new(Heads::default()),
        bus,
        Arc::new(DelayAlerts::default()),
    );
    let handle = supervisor.handle();
    tokio::spawn(supervisor.run());

    handle.request_wake();
    handle.request_wake();
    handle.request_wake();
    advance(WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;

    let _ = receiver.recv().await.expect("started");
    loop {
        let payload = receiver.recv().await.expect("event");
        let event = deserialize_recurring_processing_event(&payload).expect("decode");
        if matches!(event, RecurringProcessingEvent::Finished { .. }) {
            break;
        }
    }
    assert_eq!(processor.calls.load(Ordering::SeqCst), 1);
    handle.request_shutdown();
}

#[tokio::test(start_paused = true)]
async fn transient_delay_ensures_alert_and_sets_delayed_status() {
    let bus = RecurringProcessingEventBus::with_capacity(8);
    let mut receiver = bus.subscribe();
    let processor = Arc::new(ScriptedProcessor {
        outcomes: Mutex::new(vec![ProcessingSliceOutcome {
            committed: 0,
            already_fulfilled: 0,
            more_due_remaining: true,
            stop_reason: ProcessingStopReason::TransientlyDelayed,
            observed_local: local(2026, 1, 1, 9, 0),
        }]),
        calls: AtomicU32::new(0),
        failures: AtomicU32::new(0),
    });
    let delay = Arc::new(DelayAlerts::default());
    let supervisor = RecurringProcessingSupervisor::new(
        processor,
        Arc::new(ManualClock::new(local(2026, 1, 1, 9, 0))),
        Arc::new(Heads::default()),
        bus,
        delay.clone(),
    );
    let handle = supervisor.spawn();
    advance(WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;

    loop {
        let payload = receiver.recv().await.expect("event");
        let event = deserialize_recurring_processing_event(&payload).expect("decode");
        if matches!(
            event,
            RecurringProcessingEvent::Finished {
                state: RecurringProcessingFinishState::TransientlyDelayed,
                ..
            }
        ) {
            break;
        }
    }
    assert_eq!(delay.ensured.load(Ordering::SeqCst), 1);
    assert_eq!(handle.status(), RecurringProcessingStatus::Delayed);
    handle.request_shutdown();
}

#[tokio::test(start_paused = true)]
async fn shutdown_cancels_between_commits() {
    let bus = RecurringProcessingEventBus::with_capacity(8);
    let mut receiver = bus.subscribe();
    let processor = Arc::new(ScriptedProcessor {
        outcomes: Mutex::new(Vec::new()),
        calls: AtomicU32::new(0),
        failures: AtomicU32::new(0),
    });
    let supervisor = RecurringProcessingSupervisor::new(
        processor,
        Arc::new(ManualClock::new(local(2026, 1, 1, 9, 0))),
        Arc::new(Heads::default()),
        bus,
        Arc::new(DelayAlerts::default()),
    );
    let handle = supervisor.handle();
    let task = tokio::spawn(supervisor.run());
    handle.request_wake();
    advance(WAKE_COALESCE_WINDOW + Duration::from_millis(1)).await;
    handle.request_shutdown();
    let timeout_task =
        tokio::spawn(async move { tokio::time::timeout(Duration::from_secs(1), task).await });
    advance(Duration::from_secs(1)).await;
    let _ = timeout_task
        .await
        .expect("timeout task")
        .expect("join timeout");
    let _ = receiver.try_recv();
}

async fn advance(duration: Duration) {
    tokio::task::yield_now().await;
    tokio::time::advance(duration).await;
    tokio::task::yield_now().await;
}

async fn receive_finished(receiver: &mut tokio::sync::broadcast::Receiver<String>) {
    loop {
        let payload = receiver.recv().await.expect("event");
        let event = deserialize_recurring_processing_event(&payload).expect("decode");
        if matches!(event, RecurringProcessingEvent::Finished { .. }) {
            break;
        }
    }
}
