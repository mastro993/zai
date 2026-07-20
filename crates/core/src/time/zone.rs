use crate::{Error, Result};
use chrono_tz::Tz;
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct IanaZone(Tz);

impl IanaZone {
    pub fn parse(name: &str) -> Result<Self> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(Error::InvalidData(
                "IANA time zone must not be empty".into(),
            ));
        }
        Tz::from_str(trimmed)
            .map(Self)
            .map_err(|_| Error::InvalidData(format!("Invalid IANA time zone: {trimmed}")))
    }

    pub fn name(&self) -> &str {
        self.0.name()
    }

    pub(crate) fn tz(&self) -> Tz {
        self.0
    }
}

impl std::fmt::Display for IanaZone {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.name())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_iana_zone_without_utc_fallback() {
        let err = IanaZone::parse("Not/ARealZone").expect_err("invalid zone must fail");
        match err {
            Error::InvalidData(message) => {
                assert!(message.contains("Not/ARealZone"));
            }
            other => panic!("expected InvalidData, got {other:?}"),
        }
        assert!(
            IanaZone::parse("UTC").is_ok(),
            "UTC itself remains a valid zone"
        );
    }

    #[test]
    fn accepts_known_iana_zones() {
        let zone = IanaZone::parse("Pacific/Kiritimati").expect("valid zone");
        assert_eq!(zone.name(), "Pacific/Kiritimati");
    }

    #[test]
    fn rejects_empty_zone() {
        assert!(matches!(IanaZone::parse("   "), Err(Error::InvalidData(_))));
    }
}
