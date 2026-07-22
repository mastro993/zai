use crate::connection::DbPool;
use crate::write_actor::WriteHandle;
use std::sync::Arc;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::DomainAlertEventPublisher;

pub struct RecurringTransactionsRepository {
    pub(crate) pool: Arc<DbPool>,
    pub(crate) writer: WriteHandle,
    #[allow(dead_code)]
    pub(crate) clock: Arc<dyn CalendarClock>,
    pub(crate) alert_publisher: Arc<dyn DomainAlertEventPublisher>,
}

impl RecurringTransactionsRepository {
    #[cfg(test)]
    pub(crate) fn new(pool: Arc<DbPool>, writer: WriteHandle) -> Self {
        Self::new_with_clock_and_publisher(
            pool,
            writer,
            Arc::new(zai_core::features::budgets::traits::LocalCalendarClock),
            zai_core::features::domain_alerts::DomainAlertEventBus::new(),
        )
    }

    pub(crate) fn new_with_clock_and_publisher(
        pool: Arc<DbPool>,
        writer: WriteHandle,
        clock: Arc<dyn CalendarClock>,
        alert_publisher: Arc<dyn DomainAlertEventPublisher>,
    ) -> Self {
        Self {
            pool,
            writer,
            clock,
            alert_publisher,
        }
    }

    #[cfg(test)]
    #[allow(dead_code)]
    pub(crate) fn writer(&self) -> &WriteHandle {
        &self.writer
    }

    pub fn pool(&self) -> &Arc<DbPool> {
        &self.pool
    }
}

pub(crate) fn is_competing_fulfillment_unique_violation(error: &zai_core::Error) -> bool {
    match error {
        zai_core::Error::Database(zai_core::DatabaseError::UniqueViolation(message)) => {
            let message = message.to_ascii_lowercase();
            message.contains("recurring_occurrences")
                || message.contains("fulfillment_position")
                || message.contains("domain_alerts")
                || message.contains("occurrence_key")
        }
        _ => false,
    }
}
