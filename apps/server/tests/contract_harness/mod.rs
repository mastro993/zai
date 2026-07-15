#![allow(dead_code)]

use std::sync::Arc;

use axum::http::StatusCode;
use serde_json::{Value, json};
use zai_app::ServiceContext;
use zai_core::Error;
use zai_core::features::budgets::models::{
    BudgetLifecycleUpdate, BudgetListFilter, BudgetUpdate, NewBudget,
};
use zai_core::features::domain_alerts::{DomainAlertSeverity, ListDomainAlertsQuery};
use zai_core::features::transaction_categories::models::{
    CategoryChildrenDeleteStrategy, CategoryRole, NewTransactionCategory, TransactionCategoryUpdate,
};
use zai_core::features::transactions::models::{NewTransaction, TransactionUpdate};

use crate::common::{TempAppDataDir, request_json};

pub struct ContractHarness {
    pub context: Arc<ServiceContext>,
    pub router: axum::Router,
    pub _dir: TempAppDataDir,
}

pub async fn setup_contract(prefix: &str) -> ContractHarness {
    let (router, context, dir) = crate::common::setup_app(prefix).await;
    ContractHarness {
        context,
        router,
        _dir: dir,
    }
}

pub struct HttpCall {
    pub method: &'static str,
    pub path: String,
    pub body: Option<Value>,
    pub expected_status: StatusCode,
}

pub struct ContractExpectation {
    pub http: HttpCall,
    pub compare_body: bool,
    pub expected_error_code: Option<&'static str>,
}

pub async fn assert_read_parity(harness: &ContractHarness, expectation: ContractExpectation) {
    compare_transports(&harness.router, &harness.context, &expectation).await;
}

pub async fn compare_http_and_tauri(
    http: &ContractHarness,
    tauri: &ContractHarness,
    build_expectation: impl Fn(&str) -> ContractExpectation,
    http_id: &str,
    tauri_id: &str,
) {
    let http_expectation = build_expectation(http_id);
    let tauri_expectation = build_expectation(tauri_id);

    let (http_status, http_body) = request_json(
        &http.router,
        http_expectation.http.method,
        &http_expectation.http.path,
        http_expectation.http.body.clone(),
    )
    .await;
    assert_eq!(
        http_status, http_expectation.http.expected_status,
        "http status mismatch for {} {}: {http_body}",
        http_expectation.http.method, http_expectation.http.path
    );

    let tauri_body = run_tauri_for_http(&tauri.context, &tauri_expectation.http).await;
    compare_bodies(&http_expectation, http_body, tauri_body);
}

async fn compare_transports(
    router: &axum::Router,
    context: &ServiceContext,
    expectation: &ContractExpectation,
) {
    let (http_status, http_body) = request_json(
        router,
        expectation.http.method,
        &expectation.http.path,
        expectation.http.body.clone(),
    )
    .await;
    assert_eq!(
        http_status, expectation.http.expected_status,
        "http status mismatch for {} {}: {http_body}",
        expectation.http.method, expectation.http.path
    );

    let tauri_body = run_tauri_for_http(context, &expectation.http).await;
    compare_bodies(expectation, http_body, tauri_body);
}

fn compare_bodies(expectation: &ContractExpectation, http_body: Value, tauri_body: Value) {
    if let Some(code) = expectation.expected_error_code {
        assert_eq!(http_body["code"], code, "http error code");
        assert_eq!(tauri_body["code"], code, "tauri error code");
        if let Some(details) = http_body.get("details") {
            assert_eq!(tauri_body.get("details"), Some(details));
        }
        return;
    }

    if !expectation.compare_body {
        return;
    }

    let mut http_normalized = http_body;
    let mut tauri_normalized = tauri_body;
    normalize_response_body(&mut http_normalized);
    normalize_response_body(&mut tauri_normalized);

    assert_eq!(
        tauri_normalized, http_normalized,
        "transport bodies diverged for {} {}",
        expectation.http.method, expectation.http.path
    );
}

fn normalize_response_body(value: &mut Value) {
    match value {
        Value::Array(items) => {
            for item in &mut *items {
                normalize_entity(item);
            }
            items.sort_by(|left, right| {
                left["name"]
                    .as_str()
                    .or(left["title"].as_str())
                    .or(left["id"].as_str())
                    .unwrap_or_default()
                    .cmp(
                        right["name"]
                            .as_str()
                            .or(right["title"].as_str())
                            .or(right["id"].as_str())
                            .unwrap_or_default(),
                    )
            });
        }
        Value::Null => {}
        _ if value.get("data").is_some() => normalize_paginated(value),
        _ if value.get("items").is_some() => normalize_alert_page(value),
        _ => normalize_entity(value),
    }
}

fn normalize_paginated(value: &mut Value) {
    let Some(object) = value.as_object_mut() else {
        return;
    };
    if let Some(rows) = object.get_mut("data").and_then(Value::as_array_mut) {
        for row in &mut *rows {
            normalize_entity(row);
        }
    }
}

fn normalize_alert_page(value: &mut Value) {
    let Some(object) = value.as_object_mut() else {
        return;
    };
    if let Some(items) = object.get_mut("items").and_then(Value::as_array_mut) {
        for item in &mut *items {
            normalize_entity(item);
        }
        items.sort_by(|left, right| {
            left["title"]
                .as_str()
                .unwrap_or_default()
                .cmp(right["title"].as_str().unwrap_or_default())
        });
    }
    object.remove("nextCursor");
}

fn normalize_entity(value: &mut Value) {
    let Some(object) = value.as_object_mut() else {
        return;
    };
    object.remove("createdAt");
    object.remove("updatedAt");
    object.remove("readAt");
    object.remove("id");
    object.remove("occurrenceKey");
    object.remove("transactionDate");
    if let Some(period) = object
        .get_mut("currentPeriod")
        .and_then(Value::as_object_mut)
    {
        period.remove("start");
        period.remove("end");
    }
    if let Some(rows) = object.get_mut("data").and_then(Value::as_array_mut) {
        for row in rows {
            if let Some(period) = row.as_object_mut() {
                period.remove("start");
                period.remove("end");
            }
        }
    }
}

pub async fn run_tauri_for_http(context: &ServiceContext, call: &HttpCall) -> Value {
    let path_only = call.path.split('?').next().unwrap_or(&call.path);
    match (call.method, path_only) {
        ("GET", "/api/cash-flow/budgets") => {
            let filter = parse_budget_list_filter(&call.path);
            tauri_success(
                context.budgets_service().list_budgets(filter).await,
                "Failed to load budgets",
            )
        }
        ("GET", path)
            if path.starts_with("/api/cash-flow/budgets/") && path.ends_with("/history") =>
        {
            let budget_id = extract_suffix_id(path, "/api/cash-flow/budgets/", "/history");
            let (page, per_page) = parse_page_query(&call.path, 1, 50);
            tauri_success(
                context
                    .budgets_service()
                    .get_budget_history(&budget_id, page, per_page)
                    .await,
                "Failed to load budget history",
            )
        }
        ("GET", path) if path.starts_with("/api/cash-flow/budgets/") => {
            let budget_id = extract_suffix_id(path, "/api/cash-flow/budgets/", "");
            tauri_success(
                context.budgets_service().get_budget(&budget_id).await,
                "Failed to load budget",
            )
        }
        ("POST", "/api/cash-flow/budgets") => {
            let new_budget: NewBudget =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("budget payload");
            tauri_success(
                context.budgets_service().create_budget(new_budget).await,
                "Failed to create budget",
            )
        }
        ("PUT", path) if path.starts_with("/api/cash-flow/budgets/") => {
            let budget_id = extract_suffix_id(path, "/api/cash-flow/budgets/", "");
            let update: BudgetUpdate =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("budget update");
            tauri_success(
                context
                    .budgets_service()
                    .update_budget(&budget_id, update)
                    .await,
                "Failed to update budget",
            )
        }
        ("POST", path) if path.ends_with("/pause") => {
            let budget_id = extract_suffix_id(path, "/api/cash-flow/budgets/", "/pause");
            let update = lifecycle_update(call.body.as_ref());
            tauri_success(
                context
                    .budgets_service()
                    .pause_budget(&budget_id, update)
                    .await,
                "Failed to pause budget",
            )
        }
        ("POST", path) if path.ends_with("/resume") => {
            let budget_id = extract_suffix_id(path, "/api/cash-flow/budgets/", "/resume");
            let update = lifecycle_update(call.body.as_ref());
            tauri_success(
                context
                    .budgets_service()
                    .resume_budget(&budget_id, update)
                    .await,
                "Failed to resume budget",
            )
        }
        ("DELETE", path) if path.starts_with("/api/cash-flow/budgets/") => {
            let budget_id = extract_suffix_id(path, "/api/cash-flow/budgets/", "");
            let update = lifecycle_update(call.body.as_ref());
            match context
                .budgets_service()
                .delete_budget(&budget_id, update)
                .await
            {
                Ok(()) => Value::Null,
                Err(error) => tauri_error("Failed to delete budget", error),
            }
        }
        ("GET", "/api/cash-flow/categories") => {
            let parent_id = parse_optional_query_value(&call.path, "parentId");
            tauri_success(
                context
                    .transaction_categories_service()
                    .get_categories(parent_id.as_deref())
                    .await,
                "Failed to load transaction categories",
            )
        }
        ("GET", path) if path.starts_with("/api/cash-flow/categories/") => {
            let category_id = extract_suffix_id(path, "/api/cash-flow/categories/", "");
            tauri_success(
                context
                    .transaction_categories_service()
                    .get_category(&category_id)
                    .await,
                "Failed to load transaction category",
            )
        }
        ("POST", "/api/cash-flow/categories") => {
            let new_category: NewTransactionCategory =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("category payload");
            tauri_success(
                context
                    .transaction_categories_service()
                    .create_category(new_category)
                    .await,
                "Failed to create transaction category",
            )
        }
        ("PUT", path) if path.starts_with("/api/cash-flow/categories/") => {
            let category_id = extract_suffix_id(path, "/api/cash-flow/categories/", "");
            let body = call.body.clone().unwrap_or(Value::Null);
            let updated_category = TransactionCategoryUpdate {
                id: category_id,
                parent_id: body
                    .get("parentId")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                name: body["name"].as_str().expect("name").to_string(),
                description: body
                    .get("description")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                color: body
                    .get("color")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                role: body
                    .get("role")
                    .and_then(|value| serde_json::from_value(value.clone()).ok()),
                confirm_budget_impact: body
                    .get("confirmBudgetImpact")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
            };
            tauri_success(
                context
                    .transaction_categories_service()
                    .update_category(updated_category)
                    .await,
                "Failed to update transaction category",
            )
        }
        ("POST", "/api/cash-flow/categories/bulk-delete") => {
            let body = call.body.clone().unwrap_or(Value::Null);
            let category_ids = body["categoryIds"]
                .as_array()
                .expect("category ids")
                .iter()
                .map(|value| value.as_str().expect("category id").to_string())
                .collect::<Vec<_>>();
            let children_strategy = body
                .get("childrenStrategy")
                .and_then(|value| serde_json::from_value(value.clone()).ok())
                .unwrap_or(CategoryChildrenDeleteStrategy::Block);
            let confirm_budget_impact = body
                .get("confirmBudgetImpact")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let category_id_refs = category_ids.iter().map(String::as_str).collect::<Vec<_>>();
            tauri_success(
                context
                    .transaction_categories_service()
                    .delete_categories(category_id_refs, children_strategy, confirm_budget_impact)
                    .await,
                "Failed to delete transaction categories",
            )
        }
        ("POST", "/api/cash-flow/categories/import") => {
            let body = call.body.clone().unwrap_or(Value::Null);
            let categories: Vec<NewTransactionCategory> =
                serde_json::from_value(body["categories"].clone()).expect("categories");
            tauri_success(
                context
                    .transaction_categories_service()
                    .import_categories(categories)
                    .await,
                "Failed to import transaction categories",
            )
        }
        ("GET", "/api/cash-flow/transactions") => {
            let (page, per_page) = parse_page_query(&call.path, 1, 50);
            tauri_success(
                context
                    .transactions_service()
                    .get_transactions(page, per_page, None, None)
                    .await,
                "Failed to load transactions",
            )
        }
        ("GET", path) if path.starts_with("/api/cash-flow/transactions/") => {
            let transaction_id = extract_suffix_id(path, "/api/cash-flow/transactions/", "");
            tauri_success(
                context
                    .transactions_service()
                    .get_transaction(&transaction_id)
                    .await,
                "Failed to load transaction",
            )
        }
        ("POST", "/api/cash-flow/transactions") => {
            let new_transaction: NewTransaction =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("transaction payload");
            tauri_success(
                context
                    .transactions_service()
                    .create_transaction(new_transaction)
                    .await,
                "Failed to create transaction",
            )
        }
        ("PUT", path) if path.starts_with("/api/cash-flow/transactions/") => {
            let transaction_id = extract_suffix_id(path, "/api/cash-flow/transactions/", "");
            let body = call.body.clone().unwrap_or(Value::Null);
            let update = TransactionUpdate {
                id: transaction_id,
                description: body
                    .get("description")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                amount: body["amount"].as_i64().expect("amount") as i32,
                transaction_date: serde_json::from_value(body["transactionDate"].clone())
                    .expect("transaction date"),
                transaction_type: body["transactionType"]
                    .as_str()
                    .expect("transaction type")
                    .to_string(),
                transaction_category_id: body
                    .get("transactionCategoryId")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                notes: body
                    .get("notes")
                    .and_then(Value::as_str)
                    .map(str::to_string),
            };
            tauri_success(
                context
                    .transactions_service()
                    .update_transaction(update)
                    .await,
                "Failed to update transaction",
            )
        }
        ("DELETE", path) if path.starts_with("/api/cash-flow/transactions/") => {
            let transaction_id = extract_suffix_id(path, "/api/cash-flow/transactions/", "");
            tauri_success(
                context
                    .transactions_service()
                    .delete_transaction(&transaction_id)
                    .await,
                "Failed to delete transaction",
            )
        }
        ("POST", "/api/cash-flow/transactions/bulk-delete") => {
            let body = call.body.clone().unwrap_or(Value::Null);
            let transaction_ids = body["transactionIds"]
                .as_array()
                .expect("transaction ids")
                .iter()
                .map(|value| value.as_str().expect("transaction id"))
                .collect::<Vec<_>>();
            tauri_success(
                context
                    .transactions_service()
                    .delete_transactions(transaction_ids)
                    .await,
                "Failed to delete transactions",
            )
        }
        ("POST", "/api/cash-flow/transactions/import") => {
            let body = call.body.clone().unwrap_or(Value::Null);
            let transactions: Vec<NewTransaction> =
                serde_json::from_value(body["transactions"].clone()).expect("transactions");
            tauri_success(
                context
                    .transactions_service()
                    .import_transactions(transactions)
                    .await,
                "Failed to import transactions",
            )
        }
        ("POST", "/api/cash-flow/transactions/import-batch") => {
            let body = call.body.clone().unwrap_or(Value::Null);
            let categories: Vec<NewTransactionCategory> =
                serde_json::from_value(body["categories"].clone()).expect("categories");
            let transactions: Vec<NewTransaction> =
                serde_json::from_value(body["transactions"].clone()).expect("transactions");
            tauri_success(
                context
                    .transactions_service()
                    .import_transactions_with_categories(categories, transactions)
                    .await
                    .map(|(_, transactions)| transactions),
                "Failed to import transaction batch",
            )
        }
        ("GET", "/api/alerts") => {
            let query = parse_alerts_query(&call.path);
            tauri_success(
                context.domain_alerts_service().list_alerts(query).await,
                "Failed to load alerts",
            )
        }
        ("GET", "/api/alerts/unread-count") => tauri_success(
            context.domain_alerts_service().unread_count().await,
            "Failed to load unread alert count",
        ),
        ("POST", "/api/alerts/mark-all-read") => tauri_success(
            context.domain_alerts_service().mark_all_read().await,
            "Failed to mark all alerts read",
        ),
        ("POST", path) if path.starts_with("/api/alerts/") && path.ends_with("/read") => {
            let alert_id = extract_suffix_id(path, "/api/alerts/", "/read");
            tauri_success(
                context.domain_alerts_service().mark_read(&alert_id).await,
                "Failed to mark alert read",
            )
        }
        ("POST", path) if path.starts_with("/api/alerts/") && path.ends_with("/unread") => {
            let alert_id = extract_suffix_id(path, "/api/alerts/", "/unread");
            tauri_success(
                context.domain_alerts_service().mark_unread(&alert_id).await,
                "Failed to mark alert unread",
            )
        }
        _ => panic!("unsupported contract call: {} {}", call.method, call.path),
    }
}

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

fn lifecycle_update(body: Option<&Value>) -> BudgetLifecycleUpdate {
    serde_json::from_value(body.cloned().unwrap_or(json!({ "expectedRevision": 0 })))
        .expect("lifecycle update")
}

fn parse_budget_list_filter(path: &str) -> BudgetListFilter {
    parse_optional_query_value(path, "filter")
        .and_then(|value| serde_json::from_value(json!(value)).ok())
        .unwrap_or_default()
}

fn parse_page_query(path: &str, default_page: i64, default_per_page: i64) -> (i64, i64) {
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

fn parse_optional_query_value(path: &str, key: &str) -> Option<String> {
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

fn parse_alerts_query(path: &str) -> ListDomainAlertsQuery {
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

fn extract_suffix_id(path: &str, prefix: &str, suffix: &str) -> String {
    let trimmed = path.trim_start_matches(prefix);
    trimmed.strip_suffix(suffix).unwrap_or(trimmed).to_string()
}

pub fn category_payload(name: &str, role: CategoryRole) -> Value {
    json!({
        "name": name,
        "parentId": null,
        "description": null,
        "color": "#951818",
        "role": role
    })
}

pub fn transaction_payload(description: &str, amount: i32) -> Value {
    json!({
        "description": description,
        "amount": amount,
        "transactionDate": "2026-01-15T12:00:00",
        "transactionType": "expense",
        "transactionCategoryId": null,
        "notes": null
    })
}

pub async fn seed_category(harness: &ContractHarness, name: &str) -> (StatusCode, Value) {
    request_json(
        &harness.router,
        "POST",
        "/api/cash-flow/categories",
        Some(category_payload(name, CategoryRole::Spending)),
    )
    .await
}

pub async fn seed_transaction(harness: &ContractHarness, description: &str) -> (StatusCode, Value) {
    request_json(
        &harness.router,
        "POST",
        "/api/cash-flow/transactions",
        Some(transaction_payload(description, 1500)),
    )
    .await
}

pub async fn seed_alert(dir: &std::path::Path, occurrence_key: &str, title: &str) -> String {
    use zai_core::features::domain_alerts::{
        AlertInsertOutcome, DomainAlertSeverity, NewDomainAlert,
    };
    use zai_db::connect;

    let database = connect(dir).expect("database");
    let repository = database.domain_alerts_repository();
    let outcome = repository
        .insert(NewDomainAlert {
            id: None,
            producer_key: "budget.status".to_string(),
            occurrence_key: occurrence_key.to_string(),
            severity: DomainAlertSeverity::Warning,
            title: title.to_string(),
            body: "Body text".to_string(),
            destination: None,
            data: None,
        })
        .await
        .expect("insert alert");
    match outcome {
        AlertInsertOutcome::Created(alert) => alert.id.clone(),
        AlertInsertOutcome::AlreadyExists => panic!("expected created alert"),
    }
}
