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

pub struct TempAppDataDir {
    path: PathBuf,
}

impl TempAppDataDir {
    fn new(prefix: &str) -> Self {
        Self {
            path: env::temp_dir().join(format!("{prefix}-{}", Uuid::new_v4())),
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

pub async fn setup_app(prefix: &str) -> (axum::Router, TempAppDataDir) {
    let app_data_dir = TempAppDataDir::new(prefix);
    let context = Arc::new(
        initialize_context(app_data_dir.path()).expect("shared context should initialize"),
    );
    (create_router(context), app_data_dir)
}

pub async fn request_json(
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

pub fn sample_transaction_payload() -> Value {
    json!({
        "description": "Coffee",
        "amount": 350,
        "transactionDate": "2026-07-09T12:30:00",
        "transactionType": "expense",
        "transactionCategoryId": null,
        "notes": "Morning coffee"
    })
}

pub async fn seed_filter_test_transactions(app: &axum::Router) {
    let (status, _) = request_json(
        app,
        "POST",
        "/api/cash-flow/transactions/import-batch",
        Some(json!({
            "categories": [
                { "id": "food-cat", "name": "Food", "color": "#FF0000" },
                { "id": "travel-cat", "name": "Travel", "color": "#00FF00" }
            ],
            "transactions": [
                {
                    "description": "Morning coffee",
                    "amount": 350,
                    "transactionDate": "2026-07-05T08:00:00",
                    "transactionType": "expense",
                    "transactionCategoryId": "food-cat",
                    "notes": "cafe"
                },
                {
                    "description": "Salary payment",
                    "amount": 500000,
                    "transactionDate": "2026-07-01T12:00:00",
                    "transactionType": "income",
                    "transactionCategoryId": null
                },
                {
                    "description": "Train ticket",
                    "amount": 2500,
                    "transactionDate": "2026-07-15T14:30:00",
                    "transactionType": "expense",
                    "transactionCategoryId": "travel-cat"
                },
                {
                    "description": "Coffee beans",
                    "amount": 1200,
                    "transactionDate": "2026-07-20T10:00:00",
                    "transactionType": "expense",
                    "transactionCategoryId": "food-cat"
                },
                {
                    "description": "Freelance gig",
                    "amount": 80000,
                    "transactionDate": "2026-07-25T16:00:00",
                    "transactionType": "income",
                    "transactionCategoryId": null
                }
            ]
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
}

pub fn transaction_descriptions(body: &Value) -> Vec<String> {
    body["data"]
        .as_array()
        .expect("data array")
        .iter()
        .map(|row| row["description"].as_str().expect("description").to_string())
        .collect()
}

pub fn transaction_field_values(body: &Value, field: &str) -> Vec<String> {
    body["data"]
        .as_array()
        .expect("data array")
        .iter()
        .map(|row| row[field].as_str().expect(field).to_string())
        .collect()
}
