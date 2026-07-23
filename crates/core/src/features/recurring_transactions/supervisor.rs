use crate::Result;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
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

#[path = "supervisor_rearm.rs"]
mod rearm;

pub const WAKE_COALESCE_WINDOW: Duration = Duration::from_millis(100);
pub const CLOCK_FALLBACK_WAKE: Duration = Duration::from_secs(60);
pub const TRANSIENT_DELAY_REARM: Duration = Duration::from_millis(100);
pub const SLICE_REARM: Duration = Duration::from_millis(1);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecurringProcessingStatus {
    Idle,
    Updating,
    Delayed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringProcessingStatusView {
    pub status: RecurringProcessingStatus,
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
        let mut wake_received_during_sleep = false;
        loop {
            if self.handle.is_shutdown() {
                self.publish_shutdown();
                break;
            }

            if !self.coalesce_wakes(wake_received_during_sleep).await {
                self.publish_shutdown();
                break;
            }
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
                    wake_received_during_sleep = self.sleep_or_wake(TRANSIENT_DELAY_REARM).await;
                }
                RecurringProcessingFinishState::BudgetExhausted => {
                    self.set_status(RecurringProcessingStatus::Idle);
                    wake_received_during_sleep = self.sleep_or_wake(SLICE_REARM).await;
                }
                RecurringProcessingFinishState::CaughtUp
                | RecurringProcessingFinishState::Parked
                | RecurringProcessingFinishState::Cancelled => {
                    let (status, wait) = self.next_wait_duration().await;
                    self.set_status(status);
                    wake_received_during_sleep = self.sleep_or_wake(wait).await;
                }
                RecurringProcessingFinishState::ShuttingDown => break,
            }
        }
    }

    async fn coalesce_wakes(&self, wake_already_received: bool) -> bool {
        if !wake_already_received {
            tokio::select! {
                biased;
                _ = self.handle.shutdown_notify.notified(), if self.handle.is_shutdown() => return false,
                _ = self.handle.wake.notified() => {}
            }
        }
        let deadline = tokio::time::Instant::now() + WAKE_COALESCE_WINDOW;
        loop {
            if self.handle.is_shutdown() {
                return false;
            }
            tokio::select! {
                _ = self.handle.wake.notified() => {}
                _ = tokio::time::sleep_until(deadline) => break,
                _ = self.handle.shutdown_notify.notified(), if self.handle.is_shutdown() => return false,
            }
        }
        true
    }

    async fn execute_run(&self) -> RecurringProcessingFinishState {
        let run_id = Uuid::new_v4().to_string();
        let observed_local = self.clock.sample();
        let was_delayed = self.handle.status() == RecurringProcessingStatus::Delayed;
        self.set_status(RecurringProcessingStatus::Updating);
        let _ = self.events.publish(&RecurringProcessingEvent::Started {
            run_id: run_id.clone(),
        });

        if was_delayed && self.ensure_delay_alert().await.is_err() {
            self.publish_state_changed();
            return self.finish(
                &run_id,
                0,
                0,
                true,
                RecurringProcessingFinishState::TransientlyDelayed,
            );
        }

        let cancelled = &self.handle.shutdown;
        let mut total_committed = 0_u32;
        let mut total_fulfilled = 0_u32;

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
                        if self.reconcile_delay_alert().await.is_err() {
                            return self.finish(
                                &run_id,
                                total_committed,
                                total_fulfilled,
                                true,
                                RecurringProcessingFinishState::TransientlyDelayed,
                            );
                        }
                        self.finish(
                            &run_id,
                            total_committed,
                            total_fulfilled,
                            false,
                            RecurringProcessingFinishState::CaughtUp,
                        )
                    }
                    ProcessingStopReason::Cancelled => self.finish(
                        &run_id,
                        total_committed,
                        total_fulfilled,
                        outcome.more_due_remaining,
                        RecurringProcessingFinishState::Cancelled,
                    ),
                    ProcessingStopReason::TransientlyDelayed => {
                        if self.ensure_delay_alert().await.is_err() {
                            self.publish_state_changed();
                        }
                        self.finish(
                            &run_id,
                            total_committed,
                            total_fulfilled,
                            outcome.more_due_remaining,
                            RecurringProcessingFinishState::TransientlyDelayed,
                        )
                    }
                    ProcessingStopReason::BudgetExhausted if outcome.more_due_remaining => self
                        .finish(
                            &run_id,
                            total_committed,
                            total_fulfilled,
                            true,
                            RecurringProcessingFinishState::BudgetExhausted,
                        ),
                    ProcessingStopReason::BudgetExhausted => {
                        if self.reconcile_delay_alert().await.is_err() {
                            return self.finish(
                                &run_id,
                                total_committed,
                                total_fulfilled,
                                true,
                                RecurringProcessingFinishState::TransientlyDelayed,
                            );
                        }
                        self.finish(
                            &run_id,
                            total_committed,
                            total_fulfilled,
                            false,
                            RecurringProcessingFinishState::CaughtUp,
                        )
                    }
                }
            }
            Err(_) => {
                if self.ensure_delay_alert().await.is_err() {
                    self.publish_state_changed();
                }
                self.finish(
                    &run_id,
                    total_committed,
                    total_fulfilled,
                    true,
                    RecurringProcessingFinishState::TransientlyDelayed,
                )
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
}
