use super::models::{DomainAlert, is_valid_uuid};
use super::query::{DomainAlertListPage, ListDomainAlertsQuery};
use super::traits::{DomainAlertsRepositoryTrait, DomainAlertsServiceTrait};
use crate::{Error, Result};
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

    async fn mark_read(&self, id: &str) -> Result<DomainAlert> {
        validate_alert_id(id)?;
        self.repository.mark_read(id).await
    }

    async fn mark_unread(&self, id: &str) -> Result<DomainAlert> {
        validate_alert_id(id)?;
        self.repository.mark_unread(id).await
    }
}

fn validate_alert_id(id: &str) -> Result<()> {
    if !is_valid_uuid(id) {
        return Err(Error::InvalidData(
            "Alert id must be a valid UUID".to_string(),
        ));
    }
    Ok(())
}
