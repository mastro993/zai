use super::models::{DomainAlertRow, build_domain_alert, new_domain_alert_row};
use crate::errors::{IntoStorage, StorageError};
use crate::schema::domain_alerts;
use diesel::prelude::*;
use diesel::result::{DatabaseErrorKind, Error as DieselError};
use diesel::sqlite::SqliteConnection;
use zai_core::features::domain_alerts::{AlertInsertOutcome, NewDomainAlert};

pub fn insert_domain_alert(
    conn: &mut SqliteConnection,
    alert: &NewDomainAlert,
) -> crate::errors::Result<AlertInsertOutcome> {
    let row = new_domain_alert_row(alert).map_err(StorageError::CoreError)?;
    match diesel::insert_into(domain_alerts::table)
        .values(&row)
        .execute(conn)
    {
        Ok(_) => load_alert_by_keys(conn, &row.producer_key, &row.occurrence_key)
            .map(|alert| AlertInsertOutcome::Created(Box::new(alert))),
        Err(DieselError::DatabaseError(DatabaseErrorKind::UniqueViolation, _)) => {
            Ok(AlertInsertOutcome::AlreadyExists)
        }
        Err(error) => Err(StorageError::from(error)),
    }
}

fn load_alert_by_keys(
    conn: &mut SqliteConnection,
    producer_key: &str,
    occurrence_key: &str,
) -> crate::errors::Result<zai_core::features::domain_alerts::DomainAlert> {
    let row = domain_alerts::table
        .filter(domain_alerts::producer_key.eq(producer_key))
        .filter(domain_alerts::occurrence_key.eq(occurrence_key))
        .first::<DomainAlertRow>(conn)
        .into_storage()?;
    build_domain_alert(row).map_err(StorageError::CoreError)
}
