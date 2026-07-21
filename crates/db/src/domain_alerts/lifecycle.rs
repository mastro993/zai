use super::models::{DomainAlertRow, build_domain_alert};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::domain_alerts;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::domain_alerts::{DomainAlert, DomainAlertLifecycleOutcome};

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
    mark_domain_alert_read_with_outcome(conn, id).map(|outcome| outcome.alert)
}

pub fn mark_domain_alert_read_with_outcome(
    conn: &mut SqliteConnection,
    id: &str,
) -> crate::errors::Result<DomainAlertLifecycleOutcome> {
    let row = load_alert_row(conn, id)?;
    if row.read_at.is_some() {
        return build_domain_alert(row)
            .map(|alert| DomainAlertLifecycleOutcome {
                alert,
                changed: false,
            })
            .map_err(StorageError::CoreError);
    }

    let now = chrono::Utc::now().naive_utc();
    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(id)))
        .set((
            domain_alerts::read_at.eq(now),
            domain_alerts::updated_at.eq(now),
        ))
        .execute(conn)
        .into_storage()?;

    let updated = load_alert_row(conn, id)?;
    build_domain_alert(updated)
        .map(|alert| DomainAlertLifecycleOutcome {
            alert,
            changed: true,
        })
        .map_err(StorageError::CoreError)
}

pub fn mark_domain_alert_unread(
    conn: &mut SqliteConnection,
    id: &str,
) -> crate::errors::Result<DomainAlert> {
    mark_domain_alert_unread_with_outcome(conn, id).map(|outcome| outcome.alert)
}

pub fn mark_domain_alert_unread_with_outcome(
    conn: &mut SqliteConnection,
    id: &str,
) -> crate::errors::Result<DomainAlertLifecycleOutcome> {
    let row = load_alert_row(conn, id)?;
    if row.read_at.is_none() {
        return build_domain_alert(row)
            .map(|alert| DomainAlertLifecycleOutcome {
                alert,
                changed: false,
            })
            .map_err(StorageError::CoreError);
    }

    let now = chrono::Utc::now().naive_utc();
    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(id)))
        .set((
            domain_alerts::read_at.eq(None::<NaiveDateTime>),
            domain_alerts::updated_at.eq(now),
        ))
        .execute(conn)
        .into_storage()?;

    let updated = load_alert_row(conn, id)?;
    build_domain_alert(updated)
        .map(|alert| DomainAlertLifecycleOutcome {
            alert,
            changed: true,
        })
        .map_err(StorageError::CoreError)
}

pub fn mark_all_domain_alerts_read(conn: &mut SqliteConnection) -> crate::errors::Result<i64> {
    let now = chrono::Utc::now().naive_utc();
    diesel::update(
        domain_alerts::table
            .filter(domain_alerts::read_at.is_null())
            .filter(domain_alerts::resolved_at.is_null()),
    )
    .set((
        domain_alerts::read_at.eq(now),
        domain_alerts::updated_at.eq(now),
    ))
    .execute(conn)
    .into_storage()
    .map(|affected| affected as i64)
}

pub fn resolve_domain_alert(
    conn: &mut SqliteConnection,
    id: &str,
) -> crate::errors::Result<DomainAlertLifecycleOutcome> {
    let row = load_alert_row(conn, id)?;
    if row.resolved_at.is_some() {
        return build_domain_alert(row)
            .map(|alert| DomainAlertLifecycleOutcome {
                alert,
                changed: false,
            })
            .map_err(StorageError::CoreError);
    }

    let now = chrono::Utc::now().naive_utc();
    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(id)))
        .set((
            domain_alerts::resolved_at.eq(now),
            domain_alerts::updated_at.eq(now),
        ))
        .execute(conn)
        .into_storage()?;

    let updated = load_alert_row(conn, id)?;
    build_domain_alert(updated)
        .map(|alert| DomainAlertLifecycleOutcome {
            alert,
            changed: true,
        })
        .map_err(StorageError::CoreError)
}
