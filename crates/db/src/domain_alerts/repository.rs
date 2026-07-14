use super::insert::insert_domain_alert;
use crate::connection::DbPool;
use crate::errors::IntoCore;
use crate::write_actor::WriteHandle;
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::domain_alerts::{AlertInsertOutcome, NewDomainAlert};

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
