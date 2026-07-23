use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use crate::{Error, Result};

use super::repair::RecurringRepairField;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecurringLifecycle {
    Active,
    Paused,
    Stopped,
    Completed,
    Tombstoned,
}

impl RecurringLifecycle {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Paused => "paused",
            Self::Stopped => "stopped",
            Self::Completed => "completed",
            Self::Tombstoned => "tombstoned",
        }
    }
}

impl fmt::Display for RecurringLifecycle {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for RecurringLifecycle {
    type Err = ();

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value {
            "active" => Ok(Self::Active),
            "paused" => Ok(Self::Paused),
            "stopped" => Ok(Self::Stopped),
            "completed" => Ok(Self::Completed),
            "tombstoned" => Ok(Self::Tombstoned),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScheduleIntervalUnit {
    Day,
    Week,
    Month,
    Year,
}

impl ScheduleIntervalUnit {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Day => "day",
            Self::Week => "week",
            Self::Month => "month",
            Self::Year => "year",
        }
    }
}

impl FromStr for ScheduleIntervalUnit {
    type Err = ();

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value {
            "day" => Ok(Self::Day),
            "week" => Ok(Self::Week),
            "month" => Ok(Self::Month),
            "year" => Ok(Self::Year),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ScheduleRule {
    Interval {
        every: i32,
        unit: ScheduleIntervalUnit,
    },
    MonthlyDay {
        day: i32,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FulfillmentKind {
    Generated,
    Adopted,
}

impl FulfillmentKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Generated => "generated",
            Self::Adopted => "adopted",
        }
    }
}

impl FromStr for FulfillmentKind {
    type Err = ();

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value {
            "generated" => Ok(Self::Generated),
            "adopted" => Ok(Self::Adopted),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringTransaction {
    pub id: String,
    pub lifecycle: RecurringLifecycle,
    pub total_occurrences: Option<i32>,
    pub fulfilled_count: i32,
    pub revision: i32,
    pub lifecycle_changed_at: NaiveDateTime,
    pub paused_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub deleted_at: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringOccurrenceHead {
    pub recurring_transaction_id: String,
    pub schedule_revision_id: String,
    pub next_ordinal: i32,
    pub next_scheduled_local: NaiveDateTime,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringOccurrence {
    pub recurring_transaction_id: String,
    pub schedule_revision_id: String,
    pub ordinal: i32,
    pub scheduled_local: NaiveDateTime,
    pub template_revision_id: String,
    pub fulfilled_at: NaiveDateTime,
    pub fulfillment_position: i32,
    pub transaction_id: String,
    pub fulfillment_kind: FulfillmentKind,
    pub recurring_alert_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringGenerationFailure {
    pub recurring_transaction_id: String,
    pub schedule_revision_id: String,
    pub ordinal: i32,
    pub error_code: String,
    pub cause_category: String,
    pub repair_field_key: Option<RecurringRepairField>,
    pub correlation_id: String,
    pub failed_scheduled_local: NaiveDateTime,
    pub first_failed_at: NaiveDateTime,
    pub last_failed_at: NaiveDateTime,
    pub attempt_count: i32,
    pub repaired_at: Option<NaiveDateTime>,
    pub repair_revision: Option<i32>,
    pub resolved_at: Option<NaiveDateTime>,
    pub resolution_kind: Option<String>,
    pub generation_failure_alert_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringScheduleRevision {
    pub id: String,
    pub recurring_transaction_id: String,
    pub sequence: i32,
    pub effective_from_local: NaiveDateTime,
    pub effective_until_local: Option<NaiveDateTime>,
    pub first_scheduled_local: NaiveDateTime,
    pub rule: ScheduleRule,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringTemplateRevision {
    pub id: String,
    pub recurring_transaction_id: String,
    pub sequence: i32,
    pub effective_from_local: NaiveDateTime,
    pub effective_until_local: Option<NaiveDateTime>,
    pub description: String,
    pub amount: i32,
    pub transaction_type: String,
    pub transaction_category_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringFeedPage {
    pub items: Vec<RecurringFeedEntry>,
    pub next_cursor: Option<String>,
}

pub const MAX_FEED_SEARCH_LENGTH: usize = 200;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecurringFeedFilters {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub search: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lifecycle: Option<RecurringLifecycle>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub needs_attention: Option<bool>,
}

impl RecurringFeedFilters {
    pub fn normalized(&self) -> Result<Self> {
        let search = self
            .search
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_lowercase);
        if search
            .as_deref()
            .is_some_and(|value| value.chars().count() > MAX_FEED_SEARCH_LENGTH)
        {
            return Err(Error::InvalidData(format!(
                "Recurring feed search cannot exceed {MAX_FEED_SEARCH_LENGTH} characters"
            )));
        }
        Ok(Self {
            search,
            lifecycle: self.lifecycle,
            needs_attention: self.needs_attention,
        })
    }

    pub fn fingerprint(&self) -> String {
        let canonical = format!(
            "search={:?};lifecycle={};needsAttention={:?}",
            self.search.as_deref().unwrap_or_default(),
            self.lifecycle
                .map(RecurringLifecycle::as_str)
                .unwrap_or_default(),
            self.needs_attention
        );
        let mut hash = 0xcbf29ce484222325_u64;
        for byte in canonical.as_bytes() {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x100000001b3_u64);
        }
        format!("v1-{hash:016x}")
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringFeedEntry {
    pub recurring_transaction: RecurringTransaction,
    pub description: String,
    pub next_scheduled_local: Option<NaiveDateTime>,
    pub needs_attention: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringOccurrencePage {
    pub items: Vec<RecurringOccurrence>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringFailurePage {
    pub items: Vec<RecurringGenerationFailure>,
    pub next_cursor: Option<String>,
}

pub const DEFAULT_FEED_LIMIT: i64 = 50;
pub const MAX_FEED_LIMIT: i64 = 100;
pub const DEFAULT_FAILURE_LIMIT: i64 = 20;
pub const MAX_FAILURE_LIMIT: i64 = 100;
