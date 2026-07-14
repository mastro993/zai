use super::models::{DomainAlertRow, build_domain_alert};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::domain_alerts;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::domain_alerts::DomainAlert;

fn load_alert_row(conn: &mut SqliteConnection, id: &str) -> crate::errors::Result<DomainAlertRow> {
    domain_alerts::table
        .filter(domain_alerts::id.eq(id))
        .select(DomainAlertRow::as_select())
        .first::<DomainAlertRow>(conn)
        .optional()
        .into_storage()?
        .ok_or_else(|| StorageError::CoreError(Error::NotFound(id.to_string())))
}

pub fn mark_domain_alert_read(
    conn: &mut SqliteConnection,
    id: &str,
) -> crate::errors::Result<DomainAlert> {
    let row = load_alert_row(conn, id)?;
    if row.read_at.is_some() {
        return build_domain_alert(row).map_err(StorageError::CoreError);
    }

    let read_at = chrono::Utc::now().naive_utc();
    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(id)))
        .set(domain_alerts::read_at.eq(read_at))
        .execute(conn)
        .into_storage()?;

    let updated = load_alert_row(conn, id)?;
    build_domain_alert(updated).map_err(StorageError::CoreError)
}

pub fn mark_domain_alert_unread(
    conn: &mut SqliteConnection,
    id: &str,
) -> crate::errors::Result<DomainAlert> {
    let row = load_alert_row(conn, id)?;
    if row.read_at.is_none() {
        return build_domain_alert(row).map_err(StorageError::CoreError);
    }

    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(id)))
        .set(domain_alerts::read_at.eq(None::<NaiveDateTime>))
        .execute(conn)
        .into_storage()?;

    let updated = load_alert_row(conn, id)?;
    build_domain_alert(updated).map_err(StorageError::CoreError)
}
