use super::models::DomainAlert;
use super::outcome::DomainAlertLifecycleOutcome;
use super::query::{DomainAlertListPage, ListDomainAlertsQuery};
use crate::Result;
use async_trait::async_trait;

#[async_trait]
pub trait DomainAlertsRepositoryTrait: Send + Sync {
    async fn list_alerts(&self, query: &ListDomainAlertsQuery) -> Result<DomainAlertListPage>;
    async fn unread_count(&self) -> Result<i64>;
    async fn mark_read(&self, id: &str) -> Result<DomainAlert>;
    async fn mark_unread(&self, id: &str) -> Result<DomainAlert>;
    async fn mark_read_with_outcome(&self, id: &str) -> Result<DomainAlertLifecycleOutcome>;
    async fn mark_unread_with_outcome(&self, id: &str) -> Result<DomainAlertLifecycleOutcome>;
    async fn mark_all_read(&self) -> Result<i64>;
}

#[async_trait]
pub trait DomainAlertsServiceTrait: Send + Sync {
    async fn list_alerts(&self, query: ListDomainAlertsQuery) -> Result<DomainAlertListPage>;
    async fn unread_count(&self) -> Result<i64>;
    async fn mark_read(&self, id: &str) -> Result<DomainAlert>;
    async fn mark_unread(&self, id: &str) -> Result<DomainAlert>;
    async fn mark_read_with_outcome(&self, id: &str) -> Result<DomainAlertLifecycleOutcome>;
    async fn mark_unread_with_outcome(&self, id: &str) -> Result<DomainAlertLifecycleOutcome>;
    async fn mark_all_read(&self) -> Result<i64>;
}
