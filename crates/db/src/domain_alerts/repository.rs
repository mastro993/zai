use super::insert::insert_domain_alert;
use super::lifecycle::{
    mark_all_domain_alerts_read, mark_domain_alert_read, mark_domain_alert_unread,
};
use super::list::{list_domain_alerts_from_pool, unread_domain_alert_count_from_pool};
use crate::connection::DbPool;
use crate::errors::IntoCore;
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::domain_alerts::{
    AlertInsertOutcome, DomainAlert, DomainAlertListPage, DomainAlertsRepositoryTrait,
    ListDomainAlertsQuery, NewDomainAlert,
};

pub struct DomainAlertsRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
}

impl DomainAlertsRepository {
    #[cfg(test)]
    pub(crate) fn new(pool: Arc<DbPool>, writer: WriteHandle) -> Self {
        Self { pool, writer }
    }

    pub(crate) fn new_with_writer(pool: Arc<DbPool>, writer: WriteHandle) -> Self {
        Self { pool, writer }
    }

    pub fn pool(&self) -> &Arc<DbPool> {
        &self.pool
    }

    #[cfg(test)]
    pub(crate) fn writer(&self) -> &WriteHandle {
        &self.writer
    }

    pub fn insert_in_connection(
        conn: &mut SqliteConnection,
        alert: &NewDomainAlert,
    ) -> Result<AlertInsertOutcome> {
        insert_domain_alert(conn, alert).into_core()
    }

    pub async fn insert(&self, alert: NewDomainAlert) -> Result<AlertInsertOutcome> {
        self.writer
            .exec(move |conn| insert_domain_alert(conn, &alert))
            .await
    }
}

#[async_trait]
impl DomainAlertsRepositoryTrait for DomainAlertsRepository {
    async fn list_alerts(&self, query: &ListDomainAlertsQuery) -> Result<DomainAlertListPage> {
        list_domain_alerts_from_pool(&self.pool, query).await
    }

    async fn unread_count(&self) -> Result<i64> {
        unread_domain_alert_count_from_pool(&self.pool).await
    }

    async fn mark_read(&self, id: &str) -> Result<DomainAlert> {
        let id = id.to_string();
        self.writer
            .exec(move |conn| mark_domain_alert_read(conn, &id))
            .await
    }

    async fn mark_unread(&self, id: &str) -> Result<DomainAlert> {
        let id = id.to_string();
        self.writer
            .exec(move |conn| mark_domain_alert_unread(conn, &id))
            .await
    }

    async fn mark_all_read(&self) -> Result<i64> {
        self.writer.exec(mark_all_domain_alerts_read).await
    }
}
