use chrono::{NaiveDate, NaiveDateTime};
use zai_core::time::{IanaZone, project_utc_to_local, resolve_local_datetime_to_utc};

pub(crate) fn parse_zone(name: &str) -> crate::errors::Result<IanaZone> {
    IanaZone::parse(name).map_err(crate::errors::StorageError::CoreError)
}

pub(crate) fn wall_to_utc(
    local: NaiveDateTime,
    zone: &IanaZone,
) -> zai_core::Result<NaiveDateTime> {
    resolve_local_datetime_to_utc(local, zone).map(|instant| instant.naive_utc())
}

pub(crate) fn local_date_to_utc(
    date: NaiveDate,
    zone: &IanaZone,
) -> zai_core::Result<NaiveDateTime> {
    let midnight = date
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| zai_core::Error::InvalidData("Invalid local date".to_string()))?;
    wall_to_utc(midnight, zone)
}

pub(crate) fn utc_to_wall(utc: NaiveDateTime, zone_name: &str) -> zai_core::Result<NaiveDateTime> {
    let zone = IanaZone::parse(zone_name)?;
    Ok(project_utc_to_local(utc, &zone))
}
