use std::{
    env, fs,
    path::{Path, PathBuf},
    sync::Arc,
};

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;
use zai_app::initialize_context;
use zai_server::create_router;

struct TempAppDataDir {
    path: PathBuf,
}

impl TempAppDataDir {
    fn new() -> Self {
        Self {
            path: env::temp_dir().join(format!("zai-transactions-test-{}", Uuid::new_v4())),
        }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempAppDataDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

async fn setup_app() -> (axum::Router, TempAppDataDir) {
    let app_data_dir = TempAppDataDir::new();
    let context = Arc::new(
        initialize_context(app_data_dir.path()).expect("shared context should initialize"),
    );
    (create_router(context), app_data_dir)
}

async fn request_json(
    app: &axum::Router,
    method: &str,
    uri: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let request_builder = Request::builder().method(method).uri(uri);

    let request = if let Some(body) = body {
        request_builder
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&body).expect("json body")))
            .expect("request should build")
    } else {
        request_builder
            .body(Body::empty())
            .expect("request should build")
    };

    let response = app
        .clone()
        .oneshot(request)
        .await
        .expect("request should succeed");

    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body should read");

    let json = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).expect("response should be json")
    };

    (status, json)
}

fn sample_transaction_payload() -> Value {
    json!({
        "description": "Coffee",
        "amount": 350,
        "transactionDate": "2026-07-09T12:30:00",
        "transactionType": "expense",
        "transactionCategoryId": null,
        "notes": "Morning coffee"
    })
}

#[tokio::test]
async fn list_transactions_returns_paginated_defaults() {
    let (app, _dir) = setup_app().await;

    let (status, body) = request_json(&app, "GET", "/api/cash-flow/transactions", None).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["page"], 1);
    assert_eq!(body["perPage"], 50);
    assert!(body["data"].is_array());
}

#[tokio::test]
async fn list_transactions_rejects_uncategorized_with_category_filters() {
    let (app, _dir) = setup_app().await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?uncategorized=true&categoryId=cat-1",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(
        body["message"],
        "Choose either category filters or uncategorized only"
    );
}

#[tokio::test]
async fn list_transactions_accepts_category_and_sort_filters() {
    let (app, _dir) = setup_app().await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?page=2&perPage=10&query=coffee&transactionType=expense&startDate=2026-07-01T00%3A00%3A00&endDate=2026-07-31T23%3A59%3A59&categoryId=cat-1&categoryId=cat-2&sortField=amount&sortDesc=true",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["page"], 2);
    assert_eq!(body["perPage"], 10);
}

#[tokio::test]
async fn create_transaction_with_category_succeeds() {
    let (app, _dir) = setup_app().await;

    let (batch_status, _) = request_json(
        &app,
        "POST",
        "/api/cash-flow/transactions/import-batch",
        Some(json!({
            "categories": [{ "id": "food-cat", "name": "Food", "color": "#FF0000" }],
            "transactions": [{
                "description": "Lunch",
                "amount": 1200,
                "transactionDate": "2026-07-09T12:30:00",
                "transactionType": "expense",
                "transactionCategoryId": "food-cat"
            }]
        })),
    )
    .await;
    assert_eq!(batch_status, StatusCode::OK);

    let (status, created) = request_json(
        &app,
        "POST",
        "/api/cash-flow/transactions",
        Some(json!({
            "description": "Dinner",
            "amount": 1500,
            "transactionDate": "2026-07-10T19:00:00",
            "transactionType": "expense",
            "transactionCategoryId": "food-cat"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(created["transactionCategoryId"], "food-cat");
}

#[tokio::test]
async fn create_get_update_delete_transaction_round_trip() {
    let (app, _dir) = setup_app().await;

    let (create_status, created) = request_json(
        &app,
        "POST",
        "/api/cash-flow/transactions",
        Some(sample_transaction_payload()),
    )
    .await;

    assert_eq!(create_status, StatusCode::CREATED);
    assert_eq!(created["description"], "Coffee");
    assert_eq!(created["amount"], 350);
    assert_eq!(created["transactionType"], "expense");

    let transaction_id = created["id"].as_str().expect("created id");

    let (get_status, fetched) = request_json(
        &app,
        "GET",
        &format!("/api/cash-flow/transactions/{transaction_id}"),
        None,
    )
    .await;
    assert_eq!(get_status, StatusCode::OK);
    assert_eq!(fetched["id"], transaction_id);

    let (update_status, updated) = request_json(
        &app,
        "PUT",
        &format!("/api/cash-flow/transactions/{transaction_id}"),
        Some(json!({
            "description": "Updated coffee",
            "amount": 400,
            "transactionDate": "2026-07-10T08:00:00",
            "transactionType": "income",
            "transactionCategoryId": null,
            "notes": "Updated"
        })),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK);
    assert_eq!(updated["description"], "Updated coffee");
    assert_eq!(updated["transactionType"], "income");

    let (delete_status, deleted) = request_json(
        &app,
        "DELETE",
        &format!("/api/cash-flow/transactions/{transaction_id}"),
        None,
    )
    .await;
    assert_eq!(delete_status, StatusCode::OK);
    assert_eq!(deleted["id"], transaction_id);

    let (missing_status, missing_body) = request_json(
        &app,
        "GET",
        &format!("/api/cash-flow/transactions/{transaction_id}"),
        None,
    )
    .await;
    assert_eq!(missing_status, StatusCode::NOT_FOUND);
    assert!(
        missing_body["message"]
            .as_str()
            .expect("message")
            .contains("Failed to load transaction")
    );
}

#[tokio::test]
async fn bulk_delete_transactions_returns_deleted_rows() {
    let (app, _dir) = setup_app().await;

    let mut ids = Vec::new();
    for description in ["One", "Two"] {
        let (_, created) = request_json(
            &app,
            "POST",
            "/api/cash-flow/transactions",
            Some(json!({
                "description": description,
                "amount": 100,
                "transactionDate": "2026-07-09T12:30:00",
                "transactionType": "expense"
            })),
        )
        .await;
        ids.push(created["id"].as_str().expect("id").to_string());
    }

    let (status, deleted) = request_json(
        &app,
        "POST",
        "/api/cash-flow/transactions/bulk-delete",
        Some(json!({ "transactionIds": ids })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(deleted.as_array().expect("array").len(), 2);
}

#[tokio::test]
async fn create_transaction_rejects_invalid_type() {
    let (app, _dir) = setup_app().await;

    let (status, body) = request_json(
        &app,
        "POST",
        "/api/cash-flow/transactions",
        Some(json!({
            "description": "Bad",
            "amount": 100,
            "transactionDate": "2026-07-09T12:30:00",
            "transactionType": "transfer"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(
        body["message"]
            .as_str()
            .expect("message")
            .contains("Failed to create transaction")
    );
}

#[tokio::test]
async fn create_transaction_returns_conflict_for_missing_category() {
    let (app, _dir) = setup_app().await;

    let (status, body) = request_json(
        &app,
        "POST",
        "/api/cash-flow/transactions",
        Some(json!({
            "description": "Categorized",
            "amount": 100,
            "transactionDate": "2026-07-09T12:30:00",
            "transactionType": "expense",
            "transactionCategoryId": "missing-category"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert!(body["message"].is_string());
}

#[tokio::test]
async fn import_transactions_returns_imported_rows() {
    let (app, _dir) = setup_app().await;

    let (status, imported) = request_json(
        &app,
        "POST",
        "/api/cash-flow/transactions/import",
        Some(json!({
            "transactions": [
                {
                    "description": "Imported",
                    "amount": 500,
                    "transactionDate": "2026-07-09T12:30:00",
                    "transactionType": "expense"
                }
            ]
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(imported.as_array().expect("array").len(), 1);
}

#[tokio::test]
async fn import_transaction_batch_returns_imported_transactions_only() {
    let (app, _dir) = setup_app().await;

    let (status, imported) = request_json(
        &app,
        "POST",
        "/api/cash-flow/transactions/import-batch",
        Some(json!({
            "categories": [
                {
                    "name": "Food",
                    "color": "#FF0000"
                }
            ],
            "transactions": [
                {
                    "description": "Lunch",
                    "amount": 1200,
                    "transactionDate": "2026-07-09T12:30:00",
                    "transactionType": "expense"
                }
            ]
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(imported.as_array().expect("array").len(), 1);
    assert_eq!(imported[0]["description"], "Lunch");
}

#[tokio::test]
async fn malformed_json_returns_bad_request_message_body() {
    let (app, _dir) = setup_app().await;

    let request = Request::builder()
        .method("POST")
        .uri("/api/cash-flow/transactions")
        .header("content-type", "application/json")
        .body(Body::from("{not-json"))
        .expect("request should build");

    let response = app.oneshot(request).await.expect("request should succeed");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body should read");
    let body: Value = serde_json::from_slice(&bytes).expect("json body");
    assert!(body["message"].is_string());
}
