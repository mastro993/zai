use crate::{Error, Result};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use uuid::Uuid;

pub const MAX_RICH_DATA_BYTES: usize = 64 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DomainAlertSeverity {
    Info,
    Warning,
    Critical,
}

impl DomainAlertSeverity {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Warning => "warning",
            Self::Critical => "critical",
        }
    }
}

impl fmt::Display for DomainAlertSeverity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for DomainAlertSeverity {
    type Err = ();

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value {
            "info" => Ok(Self::Info),
            "warning" => Ok(Self::Warning),
            "critical" => Ok(Self::Critical),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DomainAlertDestination {
    Budget {
        #[serde(rename = "budgetId")]
        budget_id: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainAlertRichData {
    pub kind: String,
    pub version: u32,
    pub payload: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewDomainAlert {
    pub id: Option<String>,
    pub producer_key: String,
    pub occurrence_key: String,
    pub severity: DomainAlertSeverity,
    pub title: String,
    pub body: String,
    pub destination: Option<DomainAlertDestination>,
    pub data: Option<DomainAlertRichData>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainAlert {
    pub id: String,
    pub producer_key: String,
    pub occurrence_key: String,
    pub severity: DomainAlertSeverity,
    pub title: String,
    pub body: String,
    pub destination: Option<DomainAlertDestination>,
    pub data: Option<DomainAlertRichData>,
    pub created_at: NaiveDateTime,
    pub read_at: Option<NaiveDateTime>,
}

impl NewDomainAlert {
    pub fn validate(&self) -> Result<()> {
        if let Some(id) = &self.id
            && !is_valid_uuid(id)
        {
            return Err(Error::InvalidData(
                "Alert id must be a valid UUID".to_string(),
            ));
        }

        validate_nonblank("Producer key", &self.producer_key)?;
        validate_nonblank("Occurrence key", &self.occurrence_key)?;
        validate_nonblank("Title", &self.title)?;
        validate_nonblank("Body", &self.body)?;

        if let Some(destination) = &self.destination {
            validate_destination(destination)?;
        }

        if let Some(data) = &self.data {
            validate_rich_data(data)?;
        }

        Ok(())
    }
}

fn validate_nonblank(label: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(Error::InvalidData(format!("{label} must be nonblank")));
    }
    Ok(())
}

fn validate_destination(destination: &DomainAlertDestination) -> Result<()> {
    match destination {
        DomainAlertDestination::Budget { budget_id } => {
            if !is_valid_uuid(budget_id) {
                return Err(Error::InvalidData(
                    "Budget destination budgetId must be a valid UUID".to_string(),
                ));
            }
        }
    }
    Ok(())
}

fn validate_rich_data(data: &DomainAlertRichData) -> Result<()> {
    validate_nonblank("Rich data kind", &data.kind)?;

    if data.version == 0 {
        return Err(Error::InvalidData(
            "Rich data version must be positive".to_string(),
        ));
    }

    let serialized = serde_json::to_string(data)
        .map_err(|_| Error::InvalidData("Rich data must serialize to valid JSON".to_string()))?;

    if serialized.len() > MAX_RICH_DATA_BYTES {
        return Err(Error::InvalidData(format!(
            "Rich data must be at most {} bytes",
            MAX_RICH_DATA_BYTES
        )));
    }

    Ok(())
}

pub fn is_valid_uuid(value: &str) -> bool {
    Uuid::parse_str(value).is_ok()
}
