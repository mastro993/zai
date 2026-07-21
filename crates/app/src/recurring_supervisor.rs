use async_trait::async_trait;
use chrono::NaiveDateTime;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::recurring_transactions::{
    RECURRING_PROCESS_DELAY_OCCURRENCE_KEY, RECURRING_PROCESS_DELAY_PRODUCER_KEY,
    RecurringProcessDelayAlerts, RecurringSupervisorHeads, RecurringTransactionsRepositoryTrait,
    build_process_delay_alert,
};
use zai_db::domain_alerts::DomainAlertsRepository;

pub struct RepositorySupervisorHeads {
    repository: Arc<dyn RecurringTransactionsRepositoryTrait>,
}

impl RepositorySupervisorHeads {
    pub fn new(repository: Arc<dyn RecurringTransactionsRepositoryTrait>) -> Self {
        Self { repository }
    }
}

#[async_trait]
impl RecurringSupervisorHeads for RepositorySupervisorHeads {
    async fn earliest_active_head_after(
        &self,
        after_local: NaiveDateTime,
    ) -> Result<Option<NaiveDateTime>> {
        self.repository
            .earliest_active_head_after(after_local)
            .await
    }
}

pub struct ProcessDelayAlertPort {
    alerts: Arc<DomainAlertsRepository>,
}

impl ProcessDelayAlertPort {
    pub fn new(alerts: Arc<DomainAlertsRepository>) -> Self {
        Self { alerts }
    }
}

#[async_trait]
impl RecurringProcessDelayAlerts for ProcessDelayAlertPort {
    async fn ensure_delayed(&self) -> Result<()> {
        let alert = build_process_delay_alert()?;
        let _ = self.alerts.ensure_open(alert).await?;
        Ok(())
    }

    async fn resolve_delayed(&self) -> Result<()> {
        let _ = self
            .alerts
            .resolve_by_keys(
                RECURRING_PROCESS_DELAY_PRODUCER_KEY,
                RECURRING_PROCESS_DELAY_OCCURRENCE_KEY,
            )
            .await?;
        Ok(())
    }
}
