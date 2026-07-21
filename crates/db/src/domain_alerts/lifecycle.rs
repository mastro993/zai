use super::models::{DomainAlertRow, build_domain_alert};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::domain_alerts;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Error;
use zai_core::features::domain_alerts::{
    AlertInsertOutcome, DomainAlert, DomainAlertLifecycleOutcome, NewDomainAlert,
};

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

pub fn resolve_domain_alert_by_keys(
    conn: &mut SqliteConnection,
    producer_key: &str,
    occurrence_key: &str,
) -> crate::errors::Result<bool> {
    let row = domain_alerts::table
        .filter(domain_alerts::producer_key.eq(producer_key))
        .filter(domain_alerts::occurrence_key.eq(occurrence_key))
        .filter(domain_alerts::resolved_at.is_null())
        .select(DomainAlertRow::as_select())
        .first::<DomainAlertRow>(conn)
        .optional()
        .into_storage()?;

    let Some(row) = row else {
        return Ok(false);
    };

    Ok(resolve_domain_alert(conn, &row.id)?.changed)
}

pub fn ensure_open_domain_alert(
    conn: &mut SqliteConnection,
    alert: &NewDomainAlert,
) -> crate::errors::Result<AlertInsertOutcome> {
    let existing = domain_alerts::table
        .filter(domain_alerts::producer_key.eq(&alert.producer_key))
        .filter(domain_alerts::occurrence_key.eq(&alert.occurrence_key))
        .select(DomainAlertRow::as_select())
        .first::<DomainAlertRow>(conn)
        .optional()
        .into_storage()?;

    match existing {
        None => super::insert::insert_domain_alert(conn, alert),
        Some(row) if row.resolved_at.is_none() => {
            let now = chrono::Utc::now().naive_utc();
            diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(&row.id)))
                .set(domain_alerts::updated_at.eq(now))
                .execute(conn)
                .into_storage()?;
            Ok(AlertInsertOutcome::AlreadyExists)
        }
        Some(row) => {
            let now = chrono::Utc::now().naive_utc();
            diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(&row.id)))
                .set((
                    domain_alerts::resolved_at.eq(None::<NaiveDateTime>),
                    domain_alerts::updated_at.eq(now),
                    domain_alerts::title.eq(&alert.title),
                    domain_alerts::body.eq(&alert.body),
                    domain_alerts::severity.eq(alert.severity.as_str()),
                ))
                .execute(conn)
                .into_storage()?;
            Ok(AlertInsertOutcome::AlreadyExists)
        }
    }
}
