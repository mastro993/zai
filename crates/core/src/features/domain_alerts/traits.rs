use super::query::{DomainAlertListPage, ListDomainAlertsQuery};
use crate::Result;
use async_trait::async_trait;

#[async_trait]
pub trait DomainAlertsRepositoryTrait: Send + Sync {
    async fn list_alerts(&self, query: &ListDomainAlertsQuery) -> Result<DomainAlertListPage>;
    async fn unread_count(&self) -> Result<i64>;
}

#[async_trait]
pub trait DomainAlertsServiceTrait: Send + Sync {
    async fn list_alerts(&self, query: ListDomainAlertsQuery) -> Result<DomainAlertListPage>;
    async fn unread_count(&self) -> Result<i64>;
}
