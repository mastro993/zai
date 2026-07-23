use super::models::{
    RecurringFailurePage, RecurringGenerationFailure, RecurringLifecycle, RecurringOccurrence,
    RecurringOccurrenceHead, RecurringOccurrencePage, RecurringScheduleRevision,
    RecurringTemplateRevision, RecurringTransaction,
};
use super::repair::RecurringRecoveryAction;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringFeedItem {
    pub recurring_transaction: RecurringTransaction,
    pub description: String,
    pub next_scheduled_local: Option<NaiveDateTime>,
    pub needs_attention: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringFeedResult {
    pub items: Vec<RecurringFeedItem>,
    pub next_cursor: Option<String>,
    pub filter_fingerprint: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringOccurrenceSummary {
    pub fulfilled_count: i32,
    pub total_occurrences: Option<i32>,
    pub next_scheduled_local: Option<NaiveDateTime>,
    pub needs_attention: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecurringSectionState {
    Ready,
    Empty,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringLinksSection {
    pub state: RecurringSectionState,
    pub occurrences: RecurringOccurrencePage,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringFailuresSection {
    pub state: RecurringSectionState,
    pub unresolved: Option<RecurringGenerationFailure>,
    pub waiting_count: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_action: Option<RecurringRecoveryAction>,
    pub history: RecurringFailurePage,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringBudgetImpactSection {
    pub state: RecurringSectionState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub projection: Option<super::projection::BudgetProjectionResult>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringTransactionDocument {
    pub recurring_transaction: RecurringTransaction,
    pub schedule: RecurringScheduleRevision,
    pub template: RecurringTemplateRevision,
    pub head: Option<RecurringOccurrenceHead>,
    pub occurrence_summary: RecurringOccurrenceSummary,
    pub links: RecurringLinksSection,
    pub failures: RecurringFailuresSection,
    pub budget_impact: RecurringBudgetImpactSection,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "outcome", rename_all = "camelCase")]
pub enum RecurringCreateOutcome {
    Succeeded {
        document: RecurringTransactionDocument,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "outcome", rename_all = "camelCase")]
pub enum RecurringAdoptOutcome {
    Succeeded {
        document: RecurringTransactionDocument,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringSourceLink {
    pub id: String,
    pub description: String,
    pub lifecycle: RecurringLifecycle,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRecurringProvenance {
    pub occurrence: RecurringOccurrence,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<RecurringSourceLink>,
}

pub fn visible_source_link(
    recurring: &RecurringTransaction,
    description: &str,
) -> Option<RecurringSourceLink> {
    if recurring.lifecycle == RecurringLifecycle::Tombstoned || recurring.deleted_at.is_some() {
        return None;
    }
    Some(RecurringSourceLink {
        id: recurring.id.clone(),
        description: description.to_string(),
        lifecycle: recurring.lifecycle,
    })
}

pub fn empty_occurrence_page() -> RecurringOccurrencePage {
    RecurringOccurrencePage {
        items: Vec::new(),
        next_cursor: None,
    }
}

pub fn empty_failure_page() -> RecurringFailurePage {
    RecurringFailurePage {
        items: Vec::new(),
        next_cursor: None,
    }
}

pub fn links_section(occurrences: RecurringOccurrencePage) -> RecurringLinksSection {
    let state = if occurrences.items.is_empty() {
        RecurringSectionState::Empty
    } else {
        RecurringSectionState::Ready
    };
    RecurringLinksSection { state, occurrences }
}

pub fn failures_section(
    unresolved: Option<RecurringGenerationFailure>,
    history: RecurringFailurePage,
) -> RecurringFailuresSection {
    failures_section_with_waiting(unresolved, history, 0)
}

pub fn failures_section_with_waiting(
    unresolved: Option<RecurringGenerationFailure>,
    history: RecurringFailurePage,
    waiting_count: i32,
) -> RecurringFailuresSection {
    let next_action = unresolved
        .as_ref()
        .map(|failure| super::repair::recovery_action_for_failure(failure.repair_field_key));
    let has_unresolved = unresolved.is_some();
    let state = if !has_unresolved && history.items.is_empty() {
        RecurringSectionState::Empty
    } else {
        RecurringSectionState::Ready
    };
    RecurringFailuresSection {
        state,
        unresolved,
        waiting_count: if has_unresolved { waiting_count } else { 0 },
        next_action,
        history,
    }
}

pub fn budget_impact_unavailable() -> RecurringBudgetImpactSection {
    RecurringBudgetImpactSection {
        state: RecurringSectionState::Unavailable,
        message: Some(
            "Budget impact will appear once forecast projections are available.".to_string(),
        ),
        projection: None,
    }
}

pub fn occurrence_summary(
    recurring: &RecurringTransaction,
    head: Option<&RecurringOccurrenceHead>,
    needs_attention: bool,
) -> RecurringOccurrenceSummary {
    RecurringOccurrenceSummary {
        fulfilled_count: recurring.fulfilled_count,
        total_occurrences: recurring.total_occurrences,
        next_scheduled_local: head.map(|value| value.next_scheduled_local),
        needs_attention,
    }
}
