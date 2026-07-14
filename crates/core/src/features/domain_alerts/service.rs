use super::query::{DomainAlertListPage, ListDomainAlertsQuery};
use super::traits::{DomainAlertsRepositoryTrait, DomainAlertsServiceTrait};
use crate::Result;
use std::sync::Arc;

pub struct DomainAlertsService {
    repository: Arc<dyn DomainAlertsRepositoryTrait>,
}

impl DomainAlertsService {
    pub fn new(repository: Arc<dyn DomainAlertsRepositoryTrait>) -> Self {
        Self { repository }
    }
}

#[async_trait::async_trait]
impl DomainAlertsServiceTrait for DomainAlertsService {
    async fn list_alerts(&self, query: ListDomainAlertsQuery) -> Result<DomainAlertListPage> {
        query.validate()?;
        self.repository.list_alerts(&query).await
    }

    async fn unread_count(&self) -> Result<i64> {
        self.repository.unread_count().await
    }
}
