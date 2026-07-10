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
            path: env::temp_dir().join(format!("zai-budget-test-{}", Uuid::new_v4())),
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

struct BudgetTestApp {
    _app_data_dir: TempAppDataDir,
    app: axum::Router,
}

impl BudgetTestApp {
    fn new() -> Self {
        let app_data_dir = TempAppDataDir::new();
        let context = Arc::new(
            initialize_context(app_data_dir.path()).expect("shared context should initialize"),
        );
        Self {
            _app_data_dir: app_data_dir,
            app: create_router(context),
        }
    }

    async fn request(&self, request: Request<Body>) -> (StatusCode, Value) {
        let response = self
            .app
            .clone()
            .oneshot(request)
            .await
            .expect("request should succeed");
        let status = response.status();
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should be readable");
        let json = if body.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&body).unwrap_or_else(|_| {
                panic!(
                    "response body should be JSON, got: {}",
                    String::from_utf8_lossy(&body)
                )
            })
        };
        (status, json)
    }

    async fn get(&self, uri: &str) -> (StatusCode, Value) {
        self.request(
            Request::builder()
                .method("GET")
                .uri(uri)
                .body(Body::empty())
                .unwrap(),
        )
        .await
    }

    async fn post_json(&self, uri: &str, body: Value) -> (StatusCode, Value) {
        self.request(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
    }
}

#[tokio::test]
async fn list_budgets_returns_empty_array() {
    let app = BudgetTestApp::new();
    let (status, body) = app.get("/api/cash-flow/budgets").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!([]));
}

#[tokio::test]
async fn create_budget_requires_valid_scope() {
    let app = BudgetTestApp::new();
    let (status, body) = app
        .post_json(
            "/api/cash-flow/budgets",
            json!({
                "name": "Food",
                "allowance": 10000,
                "cadence": "monthly",
                "categoryIds": []
            }),
        )
        .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["message"]
        .as_str()
        .is_some_and(|message| message.contains("category")));
}

#[tokio::test]
async fn create_and_list_budget_succeeds() {
    let app = BudgetTestApp::new();

    let (category_status, category_body) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({
                "name": "Food",
                "parentId": null,
                "description": null,
                "color": "#951818"
            }),
        )
        .await;
    assert_eq!(category_status, StatusCode::CREATED);
    let category_id = category_body["id"].as_str().expect("category id");

    let (create_status, create_body) = app
        .post_json(
            "/api/cash-flow/budgets",
            json!({
                "name": "Food budget",
                "allowance": 50000,
                "cadence": "monthly",
                "categoryIds": [category_id]
            }),
        )
        .await;

    assert_eq!(create_status, StatusCode::CREATED);
    assert_eq!(create_body["name"], "Food budget");
    assert_eq!(create_body["status"], "active");
    assert!(create_body["currentPeriod"].is_object());

    let (list_status, list_body) = app.get("/api/cash-flow/budgets").await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list_body.as_array().map(Vec::len), Some(1));
}
