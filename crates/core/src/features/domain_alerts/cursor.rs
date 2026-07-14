use crate::{Error, Result};
use chrono::NaiveDateTime;

const CURSOR_VERSION: &str = "v1";
const CURSOR_SEPARATOR: char = '|';

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DomainAlertCursor {
    pub created_at: NaiveDateTime,
    pub id: String,
}

pub fn encode_cursor(created_at: NaiveDateTime, id: &str) -> String {
    format!(
        "{CURSOR_VERSION}{CURSOR_SEPARATOR}{}{CURSOR_SEPARATOR}{id}",
        created_at.format("%Y-%m-%dT%H:%M:%S%.9f")
    )
}

pub fn decode_cursor(value: &str) -> Result<DomainAlertCursor> {
    let mut parts = value.split(CURSOR_SEPARATOR);
    let version = parts.next().ok_or_else(invalid_cursor)?;
    if version != CURSOR_VERSION {
        return Err(invalid_cursor());
    }
    let created_at_raw = parts.next().ok_or_else(invalid_cursor)?;
    let id = parts.next().ok_or_else(invalid_cursor)?;
    if parts.next().is_some() {
        return Err(invalid_cursor());
    }
    let created_at = NaiveDateTime::parse_from_str(created_at_raw, "%Y-%m-%dT%H:%M:%S%.9f")
        .or_else(|_| NaiveDateTime::parse_from_str(created_at_raw, "%Y-%m-%dT%H:%M:%S%.f"))
        .map_err(|_| invalid_cursor())?;
    if !super::models::is_valid_uuid(id) {
        return Err(invalid_cursor());
    }
    Ok(DomainAlertCursor {
        created_at,
        id: id.to_string(),
    })
}

fn invalid_cursor() -> Error {
    Error::InvalidData("Invalid alert list cursor".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    #[test]
    fn cursor_round_trips_canonical_pair() {
        let created_at = NaiveDate::from_ymd_opt(2026, 7, 14)
            .unwrap()
            .and_hms_nano_opt(12, 0, 0, 123_456_789)
            .unwrap();
        let id = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
        let encoded = encode_cursor(created_at, id);
        let decoded = decode_cursor(&encoded).expect("cursor should decode");
        assert_eq!(decoded.created_at, created_at);
        assert_eq!(decoded.id, id);
    }

    #[test]
    fn rejects_unknown_cursor_versions() {
        let err =
            decode_cursor("v2|2026-07-14T12:00:00.000000000|6ba7b810-9dad-11d1-80b4-00c04fd430c8")
                .expect_err("unknown version should fail");
        assert!(matches!(err, Error::InvalidData(_)));
    }
}
