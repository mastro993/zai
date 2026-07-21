use crate::Result;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tokio::sync::Notify;
use uuid::Uuid;

use super::events::{
    RecurringProcessingEvent, RecurringProcessingEventPublisher, RecurringProcessingFinishState,
};
use super::process::{ProcessingStopReason, ProcessingWorkBudget};
use super::traits::{RecurringOccurrenceProcessor, RecurringProcessingWake};
use crate::features::budgets::traits::CalendarClock;

pub const WAKE_COALESCE_WINDOW: Duration = Duration::from_millis(100);
pub const CLOCK_FALLBACK_WAKE: Duration = Duration::from_secs(60);
pub const TRANSIENT_DELAY_REARM: Duration = Duration::from_millis(100);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecurringProcessingStatus {
    Idle,
    Updating,
    Delayed,
}

#[async_trait]
pub trait RecurringProcessDelayAlerts: Send + Sync {
    async fn ensure_delayed(&self) -> Result<()>;
    async fn resolve_delayed(&self) -> Result<()>;
}

#[async_trait]
pub trait RecurringSupervisorHeads: Send + Sync {
    async fn earliest_active_head_after(
        &self,
        after_local: NaiveDateTime,
    ) -> Result<Option<NaiveDateTime>>;
}

#[derive(Clone)]
pub struct RecurringProcessingSupervisorHandle {
    wake: Arc<Notify>,
    shutdown: Arc<AtomicBool>,
    shutdown_notify: Arc<Notify>,
    status: Arc<std::sync::RwLock<RecurringProcessingStatus>>,
}

impl RecurringProcessingSupervisorHandle {
    pub fn request_wake(&self) {
        self.wake.notify_one();
    }

    pub fn request_shutdown(&self) {
        self.shutdown.store(true, Ordering::SeqCst);
        self.shutdown_notify.notify_waiters();
        self.wake.notify_one();
    }

    pub fn status(&self) -> RecurringProcessingStatus {
        *self.status.read().expect("status lock")
    }

    pub fn is_shutdown(&self) -> bool {
        self.shutdown.load(Ordering::SeqCst)
    }
}

impl RecurringProcessingWake for RecurringProcessingSupervisorHandle {
    fn request_wake(&self) {
        self.wake.notify_one();
    }
}

pub struct RecurringProcessingSupervisor {
    processor: Arc<dyn RecurringOccurrenceProcessor>,
    clock: Arc<dyn CalendarClock>,
    heads: Arc<dyn RecurringSupervisorHeads>,
    events: Arc<dyn RecurringProcessingEventPublisher>,
    delay_alerts: Arc<dyn RecurringProcessDelayAlerts>,
    handle: RecurringProcessingSupervisorHandle,
}

impl RecurringProcessingSupervisor {
    pub fn new(
        processor: Arc<dyn RecurringOccurrenceProcessor>,
        clock: Arc<dyn CalendarClock>,
        heads: Arc<dyn RecurringSupervisorHeads>,
        events: Arc<dyn RecurringProcessingEventPublisher>,
        delay_alerts: Arc<dyn RecurringProcessDelayAlerts>,
    ) -> Self {
        Self {
            processor,
            clock,
            heads,
            events,
            delay_alerts,
            handle: RecurringProcessingSupervisorHandle {
                wake: Arc::new(Notify::new()),
                shutdown: Arc::new(AtomicBool::new(false)),
                shutdown_notify: Arc::new(Notify::new()),
                status: Arc::new(std::sync::RwLock::new(RecurringProcessingStatus::Idle)),
            },
        }
    }

    pub fn handle(&self) -> RecurringProcessingSupervisorHandle {
        self.handle.clone()
    }

    pub fn spawn(self) -> RecurringProcessingSupervisorHandle {
        let handle = self.handle();
        handle.request_wake();
        tokio::spawn(async move {
            self.run().await;
        });
        handle
    }

    pub async fn run(self) {
        loop {
            if self.handle.is_shutdown() {
                self.publish_shutdown();
                break;
            }

            self.coalesce_wakes().await;
            if self.handle.is_shutdown() {
                self.publish_shutdown();
                break;
            }

            let finish = self.execute_run().await;
            if self.handle.is_shutdown() {
                self.publish_shutdown();
                break;
            }

            match finish {
                RecurringProcessingFinishState::TransientlyDelayed => {
                    self.set_status(RecurringProcessingStatus::Delayed);
                    self.sleep_or_wake(TRANSIENT_DELAY_REARM).await;
                }
                RecurringProcessingFinishState::CaughtUp
                | RecurringProcessingFinishState::Parked
                | RecurringProcessingFinishState::Cancelled
                | RecurringProcessingFinishState::BudgetExhausted => {
                    self.set_status(RecurringProcessingStatus::Idle);
                    let wait = self.next_wait_duration().await;
                    self.sleep_or_wake(wait).await;
                }
                RecurringProcessingFinishState::ShuttingDown => break,
            }
        }
    }

    async fn coalesce_wakes(&self) {
        tokio::select! {
            biased;
            _ = self.handle.shutdown_notify.notified(), if self.handle.is_shutdown() => return,
            _ = self.handle.wake.notified() => {}
        }
        let deadline = tokio::time::Instant::now() + WAKE_COALESCE_WINDOW;
        loop {
            if self.handle.is_shutdown() {
                return;
            }
            tokio::select! {
                _ = self.handle.wake.notified() => {}
                _ = tokio::time::sleep_until(deadline) => break,
                _ = self.handle.shutdown_notify.notified(), if self.handle.is_shutdown() => return,
            }
        }
    }

    async fn execute_run(&self) -> RecurringProcessingFinishState {
        let run_id = Uuid::new_v4().to_string();
        let observed_local = self.clock.sample();
        self.set_status(RecurringProcessingStatus::Updating);
        let _ = self.events.publish(&RecurringProcessingEvent::Started {
            run_id: run_id.clone(),
        });

        let cancelled = &self.handle.shutdown;
        let mut total_committed = 0_u32;
        let mut total_fulfilled = 0_u32;

        loop {
            if self.handle.is_shutdown() {
                return self.finish(
                    &run_id,
                    total_committed,
                    total_fulfilled,
                    true,
                    RecurringProcessingFinishState::Cancelled,
                );
            }

            match self
                .processor
                .process_due(
                    observed_local,
                    ProcessingWorkBudget::default_slice(),
                    Some(cancelled),
                )
                .await
            {
                Ok(outcome) => {
                    total_committed += outcome.committed;
                    total_fulfilled += outcome.already_fulfilled;
                    if outcome.committed > 0 {
                        let _ = self.events.publish(&RecurringProcessingEvent::Progress {
                            run_id: run_id.clone(),
                            committed: total_committed,
                            already_fulfilled: total_fulfilled,
                            more_due_remaining: outcome.more_due_remaining,
                        });
                    }

                    match outcome.stop_reason {
                        ProcessingStopReason::CaughtUp => {
                            let _ = self.delay_alerts.resolve_delayed().await;
                            return self.finish(
                                &run_id,
                                total_committed,
                                total_fulfilled,
                                false,
                                RecurringProcessingFinishState::CaughtUp,
                            );
                        }
                        ProcessingStopReason::Cancelled => {
                            return self.finish(
                                &run_id,
                                total_committed,
                                total_fulfilled,
                                outcome.more_due_remaining,
                                RecurringProcessingFinishState::Cancelled,
                            );
                        }
                        ProcessingStopReason::TransientlyDelayed => {
                            let _ = self.delay_alerts.ensure_delayed().await;
                            return self.finish(
                                &run_id,
                                total_committed,
                                total_fulfilled,
                                outcome.more_due_remaining,
                                RecurringProcessingFinishState::TransientlyDelayed,
                            );
                        }
                        ProcessingStopReason::BudgetExhausted if outcome.more_due_remaining => {
                            tokio::task::yield_now().await;
                        }
                        ProcessingStopReason::BudgetExhausted => {
                            let _ = self.delay_alerts.resolve_delayed().await;
                            return self.finish(
                                &run_id,
                                total_committed,
                                total_fulfilled,
                                false,
                                RecurringProcessingFinishState::CaughtUp,
                            );
                        }
                    }
                }
                Err(_) => {
                    let _ = self.events.publish(&RecurringProcessingEvent::StateChanged);
                    return self.finish(
                        &run_id,
                        total_committed,
                        total_fulfilled,
                        false,
                        RecurringProcessingFinishState::Parked,
                    );
                }
            }
        }
    }

    fn finish(
        &self,
        run_id: &str,
        committed: u32,
        already_fulfilled: u32,
        more_due_remaining: bool,
        state: RecurringProcessingFinishState,
    ) -> RecurringProcessingFinishState {
        let _ = self.events.publish(&RecurringProcessingEvent::Finished {
            run_id: run_id.to_string(),
            committed,
            already_fulfilled,
            more_due_remaining,
            state,
        });
        state
    }

    fn publish_shutdown(&self) {
        self.set_status(RecurringProcessingStatus::Idle);
        let _ = self.events.publish(&RecurringProcessingEvent::Finished {
            run_id: Uuid::new_v4().to_string(),
            committed: 0,
            already_fulfilled: 0,
            more_due_remaining: false,
            state: RecurringProcessingFinishState::ShuttingDown,
        });
    }

    async fn next_wait_duration(&self) -> Duration {
        let observed = self.clock.sample();
        match self.heads.earliest_active_head_after(observed).await {
            Ok(Some(next)) => {
                let delta = (next - observed)
                    .to_std()
                    .unwrap_or(CLOCK_FALLBACK_WAKE)
                    .min(CLOCK_FALLBACK_WAKE);
                if delta.is_zero() {
                    Duration::from_millis(1)
                } else {
                    delta
                }
            }
            _ => CLOCK_FALLBACK_WAKE,
        }
    }

    async fn sleep_or_wake(&self, wait: Duration) {
        tokio::select! {
            _ = tokio::time::sleep(wait) => {}
            _ = self.handle.wake.notified() => {}
            _ = self.handle.shutdown_notify.notified(), if self.handle.is_shutdown() => {}
        }
    }

    fn set_status(&self, status: RecurringProcessingStatus) {
        *self.handle.status.write().expect("status lock") = status;
    }
}
