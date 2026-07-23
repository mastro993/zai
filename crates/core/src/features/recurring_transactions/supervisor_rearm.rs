use super::{
    CLOCK_FALLBACK_WAKE, RecurringProcessingEvent, RecurringProcessingStatus,
    RecurringProcessingSupervisor, TRANSIENT_DELAY_REARM,
};
use crate::Result;
use std::time::Duration;

impl RecurringProcessingSupervisor {
    pub(super) async fn next_wait_duration(&self) -> (RecurringProcessingStatus, Duration) {
        let observed = self.clock.sample();
        match self.heads.earliest_active_head_after(observed).await {
            Ok(Some(next)) => (RecurringProcessingStatus::Idle, {
                if next <= observed {
                    Duration::from_millis(1)
                } else {
                    (next - observed)
                        .to_std()
                        .unwrap_or(CLOCK_FALLBACK_WAKE)
                        .min(CLOCK_FALLBACK_WAKE)
                }
            }),
            Ok(None) => (RecurringProcessingStatus::Idle, CLOCK_FALLBACK_WAKE),
            Err(_) => {
                if self.ensure_delay_alert().await.is_err() {
                    self.publish_state_changed();
                }
                (RecurringProcessingStatus::Delayed, TRANSIENT_DELAY_REARM)
            }
        }
    }

    pub(super) async fn ensure_delay_alert(&self) -> Result<()> {
        self.delay_alerts.ensure_delayed().await
    }

    pub(super) async fn reconcile_delay_alert(&self) -> Result<()> {
        self.delay_alerts.resolve_delayed().await
    }

    pub(super) async fn sleep_or_wake(&self, wait: Duration) -> bool {
        tokio::select! {
            _ = tokio::time::sleep(wait) => true,
            _ = self.handle.wake.notified() => true,
            _ = self.handle.shutdown_notify.notified(), if self.handle.is_shutdown() => false,
        }
    }

    pub(super) fn publish_state_changed(&self) {
        let _ = self.events.publish(&RecurringProcessingEvent::StateChanged);
    }

    pub(super) fn set_status(&self, status: RecurringProcessingStatus) {
        *self.handle.status.write().expect("status lock") = status;
    }
}
