use super::models::{DomainAlert, DomainAlertSeverity};
use crate::Result;
use serde::{Deserialize, Deserializer, Serialize};

pub const DEFAULT_LIST_LIMIT: i64 = 50;
pub const MIN_LIST_LIMIT: i64 = 1;
pub const MAX_LIST_LIMIT: i64 = 100;

pub fn deserialize_optional_severities<'de, D>(
    deserializer: D,
) -> std::result::Result<Option<Vec<DomainAlertSeverity>>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum SeverityInput {
        One(DomainAlertSeverity),
        Many(Vec<DomainAlertSeverity>),
    }

    match Option::<SeverityInput>::deserialize(deserializer)? {
        None => Ok(None),
        Some(SeverityInput::One(severity)) => Ok(Some(vec![severity])),
        Some(SeverityInput::Many(severities)) => Ok(Some(severities)),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum DomainAlertReadState {
    #[default]
    All,
    Read,
    Unread,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ListDomainAlertsQuery {
    pub cursor: Option<String>,
    pub limit: Option<i64>,
    pub read_state: Option<DomainAlertReadState>,
    #[serde(default, deserialize_with = "deserialize_optional_severities")]
    pub severities: Option<Vec<DomainAlertSeverity>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainAlertListPage {
    pub items: Vec<DomainAlert>,
    pub next_cursor: Option<String>,
}

impl ListDomainAlertsQuery {
    pub fn normalized_limit(&self) -> Result<i64> {
        let limit = self.limit.unwrap_or(DEFAULT_LIST_LIMIT);
        if !(MIN_LIST_LIMIT..=MAX_LIST_LIMIT).contains(&limit) {
            return Err(crate::Error::InvalidData(format!(
                "Alert list limit must be between {MIN_LIST_LIMIT} and {MAX_LIST_LIMIT}"
            )));
        }
        Ok(limit)
    }

    pub fn normalized_read_state(&self) -> DomainAlertReadState {
        self.read_state.unwrap_or_default()
    }

    pub fn validate(&self) -> Result<()> {
        self.normalized_limit()?;
        if let Some(severities) = &self.severities
            && severities.is_empty()
        {
            return Err(crate::Error::InvalidData(
                "Alert severity filter must not be empty".to_string(),
            ));
        }
        if let Some(cursor) = &self.cursor {
            super::cursor::decode_cursor(cursor)?;
        }
        Ok(())
    }
}
