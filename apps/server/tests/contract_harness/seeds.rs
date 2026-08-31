#![allow(dead_code)]

use axum::http::StatusCode;
use serde_json::{Value, json};
use zai_core::features::transaction_categories::models::CategoryRole;

use super::ContractHarness;
use crate::common::request_json;

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
        "currency": "EUR",
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
        "/api/categories",
        Some(category_payload(name, CategoryRole::Spending)),
    )
    .await
}

pub async fn seed_transaction(harness: &ContractHarness, description: &str) -> (StatusCode, Value) {
    seed_transaction_at(harness, description, "2026-01-15T12:00:00").await
}

pub async fn seed_transaction_at(
    harness: &ContractHarness,
    description: &str,
    transaction_date: &str,
) -> (StatusCode, Value) {
    let mut payload = transaction_payload(description, 1500);
    payload["transactionDate"] = Value::String(transaction_date.to_string());
    request_json(&harness.router, "POST", "/api/transactions", Some(payload)).await
}

pub async fn seed_alert(zai_home: &std::path::Path, occurrence_key: &str, title: &str) -> String {
    use zai_core::features::domain_alerts::{
        AlertInsertOutcome, DomainAlertSeverity, NewDomainAlert,
    };
    use zai_db::connect;

    let database = connect(zai_home.join("userdata")).expect("database");
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
