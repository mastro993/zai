#![allow(dead_code)]

use serde_json::{Value, json};
use zai_core::Error;
use zai_core::features::budgets::models::BudgetLifecycleUpdate;
use zai_core::features::budgets::models::BudgetListFilter;
use zai_core::features::domain_alerts::{DomainAlertSeverity, ListDomainAlertsQuery};

pub fn tauri_success<T: serde::Serialize>(
    result: Result<T, Error>,
    context: &'static str,
) -> Value {
    match result {
        Ok(value) => serde_json::to_value(value).expect("serialize success"),
        Err(error) => tauri_error(context, error),
    }
}

pub fn tauri_error(context: &'static str, error: Error) -> Value {
    serde_json::to_value(error.to_envelope(context)).expect("serialize error")
}

pub(crate) fn lifecycle_update(body: Option<&Value>) -> BudgetLifecycleUpdate {
    serde_json::from_value(body.cloned().unwrap_or(json!({ "expectedRevision": 0 })))
        .expect("lifecycle update")
}

pub(crate) fn parse_budget_list_filter(path: &str) -> BudgetListFilter {
    parse_optional_query_value(path, "filter")
        .and_then(|value| serde_json::from_value(json!(value)).ok())
        .unwrap_or_default()
}

pub(crate) fn parse_page_query(path: &str, default_page: i64, default_per_page: i64) -> (i64, i64) {
    let mut page = default_page;
    let mut per_page = default_per_page;
    let Some(query) = path.split_once('?').map(|(_, query)| query) else {
        return (page, per_page);
    };
    for pair in query.split('&') {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        match key {
            "page" => page = value.parse().unwrap_or(page),
            "perPage" => per_page = value.parse().unwrap_or(per_page),
            _ => {}
        }
    }
    (page, per_page)
}

pub fn parse_optional_query_value(path: &str, key: &str) -> Option<String> {
    let query = path.split_once('?').map(|(_, query)| query)?;
    for pair in query.split('&') {
        let Some((query_key, value)) = pair.split_once('=') else {
            continue;
        };
        if query_key == key {
            return Some(value.to_string());
        }
    }
    None
}

pub(crate) fn parse_alerts_query(path: &str) -> ListDomainAlertsQuery {
    let mut query = ListDomainAlertsQuery::default();
    let Some(query_string) = path.split_once('?').map(|(_, value)| value) else {
        return query;
    };

    for pair in query_string.split('&') {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        match key {
            "cursor" => query.cursor = Some(value.to_string()),
            "limit" => query.limit = value.parse().ok(),
            "readState" => {
                query.read_state = serde_json::from_value(json!(value)).ok();
            }
            "severities" => {
                let severity: DomainAlertSeverity =
                    serde_json::from_value(json!(value)).unwrap_or(DomainAlertSeverity::Info);
                query.severities = Some(vec![severity]);
            }
            _ => {}
        }
    }

    query
}

pub fn extract_suffix_id(path: &str, prefix: &str, suffix: &str) -> String {
    let trimmed = path.trim_start_matches(prefix);
    trimmed.strip_suffix(suffix).unwrap_or(trimmed).to_string()
}
