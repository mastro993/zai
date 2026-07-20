use crate::schema::domain_alerts;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use zai_core::features::domain_alerts::{DomainAlert, DomainAlertSeverity, NewDomainAlert};
use zai_core::{Error, Result};

#[derive(Queryable, Identifiable, Insertable, Selectable, Debug, Clone)]
#[diesel(table_name = domain_alerts)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct DomainAlertRow {
    pub id: String,
    pub producer_key: String,
    pub occurrence_key: String,
    pub severity: String,
    pub title: String,
    pub body: String,
    pub destination: Option<String>,
    pub data: Option<String>,
    pub created_at: NaiveDateTime,
    pub read_at: Option<NaiveDateTime>,
    pub updated_at: NaiveDateTime,
    pub resolved_at: Option<NaiveDateTime>,
}

#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = domain_alerts)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct NewDomainAlertRow {
    pub id: String,
    pub producer_key: String,
    pub occurrence_key: String,
    pub severity: String,
    pub title: String,
    pub body: String,
    pub destination: Option<String>,
    pub data: Option<String>,
}

pub fn new_domain_alert_row(alert: &NewDomainAlert) -> Result<NewDomainAlertRow> {
    alert.validate()?;

    let id = alert
        .id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    Ok(NewDomainAlertRow {
        id,
        producer_key: alert.producer_key.clone(),
        occurrence_key: alert.occurrence_key.clone(),
        severity: alert.severity.as_str().to_string(),
        title: alert.title.clone(),
        body: alert.body.clone(),
        destination: serialize_optional_json(alert.destination.as_ref())?,
        data: serialize_optional_json(alert.data.as_ref())?,
    })
}

pub fn build_domain_alert(row: DomainAlertRow) -> Result<DomainAlert> {
    let severity = row
        .severity
        .parse::<DomainAlertSeverity>()
        .map_err(|_| Error::Repository("Invalid domain alert severity".to_string()))?;
    let destination = deserialize_optional_json(row.destination.as_deref())?;
    let data = deserialize_optional_json(row.data.as_deref())?;

    Ok(DomainAlert {
        id: row.id,
        producer_key: row.producer_key,
        occurrence_key: row.occurrence_key,
        severity,
        title: row.title,
        body: row.body,
        destination,
        data,
        created_at: row.created_at,
        read_at: row.read_at,
    })
}

fn serialize_optional_json<T: serde::Serialize>(value: Option<&T>) -> Result<Option<String>> {
    value
        .map(serde_json::to_string)
        .transpose()
        .map_err(|_| Error::Repository("Failed to serialize domain alert JSON field".to_string()))
}

fn deserialize_optional_json<T: for<'de> serde::Deserialize<'de>>(
    value: Option<&str>,
) -> Result<Option<T>> {
    value
        .map(serde_json::from_str)
        .transpose()
        .map_err(|_| Error::Repository("Failed to deserialize domain alert JSON field".to_string()))
}
