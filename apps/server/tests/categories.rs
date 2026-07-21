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
            path: env::temp_dir().join(format!("zai-category-test-{}", Uuid::new_v4())),
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

struct CategoryTestApp {
    _app_data_dir: TempAppDataDir,
    app: axum::Router,
}

impl CategoryTestApp {
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

    async fn put_json(&self, uri: &str, body: Value) -> (StatusCode, Value) {
        self.request(
            Request::builder()
                .method("PUT")
                .uri(uri)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
    }
}

#[tokio::test]
async fn list_categories_returns_empty_array() {
    let app = CategoryTestApp::new();
    let (status, body) = app.get("/api/cash-flow/categories").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!([]));
}

#[tokio::test]
async fn preview_category_deletion_returns_recurring_impact_shape() {
    let app = CategoryTestApp::new();
    let (_, category) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Food", "role": "spending" }),
        )
        .await;
    let category_id = category["id"].as_str().expect("category id");

    let (status, body) = app
        .post_json(
            "/api/cash-flow/categories/bulk-delete/preview",
            json!({ "categoryIds": [category_id], "childrenStrategy": "block" }),
        )
        .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!({ "affectedRecurringTransactions": [] }));
}

#[tokio::test]
async fn create_root_category_returns_created_category() {
    let app = CategoryTestApp::new();
    let (status, body) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({
                "name": "Food",
                "description": "Meals",
                "color": "#ff0000",
                "role": "spending"
            }),
        )
        .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["name"], "Food");
    assert_eq!(body["description"], "Meals");
    assert_eq!(body["color"], "#FF0000");
    assert_eq!(body["role"], "spending");
    assert!(body["id"].is_string());
    assert!(body["parentId"].is_null());
}

#[tokio::test]
async fn create_child_category_returns_created_category() {
    let app = CategoryTestApp::new();
    let (_, root) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Food", "color": "#ff0000", "role": "spending" }),
        )
        .await;
    let root_id = root["id"].as_str().expect("root id");

    let (status, body) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({
                "name": "Groceries",
                "parentId": root_id,
                "color": "#00ff00"
            }),
        )
        .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["name"], "Groceries");
    assert_eq!(body["parentId"], root_id);
    assert_eq!(body["role"], "spending");
}

#[tokio::test]
async fn category_roles_validate_and_inherit_across_the_http_contract() {
    let app = CategoryTestApp::new();
    let (missing_role_status, missing_role_body) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Salary", "color": "#ff0000" }),
        )
        .await;

    assert_eq!(missing_role_status, StatusCode::BAD_REQUEST);
    assert_eq!(missing_role_body["code"], "validation");

    let (_, root) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Salary", "color": "#ff0000", "role": "income" }),
        )
        .await;
    let root_id = root["id"].as_str().expect("root id");

    let (child_status, child) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Bonus", "parentId": root_id }),
        )
        .await;
    assert_eq!(child_status, StatusCode::CREATED);
    assert_eq!(child["role"], "income");

    let (invalid_child_status, invalid_child) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({
                "name": "Salary sacrifice",
                "parentId": root_id,
                "role": "spending"
            }),
        )
        .await;
    assert_eq!(invalid_child_status, StatusCode::BAD_REQUEST);
    assert_eq!(invalid_child["code"], "validation");
}

#[tokio::test]
async fn updating_a_root_role_updates_child_reads() {
    let app = CategoryTestApp::new();
    let (_, root) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Salary", "role": "income" }),
        )
        .await;
    let root_id = root["id"].as_str().expect("root id");
    let (_, child) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Bonus", "parentId": root_id }),
        )
        .await;
    let child_id = child["id"].as_str().expect("child id");

    let (status, _) = app
        .put_json(
            &format!("/api/cash-flow/categories/{root_id}"),
            json!({ "name": "Salary", "role": "spending" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    let (child_status, child) = app
        .get(&format!("/api/cash-flow/categories/{child_id}"))
        .await;
    assert_eq!(child_status, StatusCode::OK);
    assert_eq!(child["role"], "spending");
}

#[tokio::test]
async fn list_categories_filters_by_parent_id() {
    let app = CategoryTestApp::new();
    let (_, root) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Food", "color": "#ff0000", "role": "spending" }),
        )
        .await;
    let root_id = root["id"].as_str().expect("root id");
    app.post_json(
        "/api/cash-flow/categories",
        json!({
            "name": "Groceries",
            "parentId": root_id,
            "color": "#00ff00"
        }),
    )
    .await;
    app.post_json(
        "/api/cash-flow/categories",
        json!({ "name": "Travel", "color": "#0000ff", "role": "spending" }),
    )
    .await;

    let (status, body) = app
        .get(&format!("/api/cash-flow/categories?parentId={root_id}"))
        .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_array().expect("array").len(), 1);
    assert_eq!(body[0]["name"], "Groceries");
}

#[tokio::test]
async fn malformed_category_query_returns_validation_envelope() {
    let app = CategoryTestApp::new();
    let (status, body) = app
        .get("/api/cash-flow/categories?parentId=one&parentId=two")
        .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "validation");
    assert!(body["message"].is_string());
}

#[tokio::test]
async fn get_category_returns_single_category() {
    let app = CategoryTestApp::new();
    let (_, created) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Food", "color": "#ff0000", "role": "spending" }),
        )
        .await;
    let category_id = created["id"].as_str().expect("category id");

    let (status, body) = app
        .get(&format!("/api/cash-flow/categories/{category_id}"))
        .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["id"], category_id);
    assert_eq!(body["name"], "Food");
}

#[tokio::test]
async fn update_category_returns_updated_category() {
    let app = CategoryTestApp::new();
    let (_, created) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Food", "color": "#ff0000", "role": "spending" }),
        )
        .await;
    let category_id = created["id"].as_str().expect("category id");

    let (status, body) = app
        .put_json(
            &format!("/api/cash-flow/categories/{category_id}"),
            json!({
                "name": "Dining",
                "description": "Restaurants",
                "color": "#123456",
                "role": "spending"
            }),
        )
        .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["id"], category_id);
    assert_eq!(body["name"], "Dining");
    assert_eq!(body["description"], "Restaurants");
    assert_eq!(body["color"], "#123456");
}

#[tokio::test]
async fn bulk_delete_returns_deleted_categories() {
    let app = CategoryTestApp::new();
    let (_, created) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Food", "color": "#ff0000", "role": "spending" }),
        )
        .await;
    let category_id = created["id"].as_str().expect("category id");

    let (status, body) = app
        .post_json(
            "/api/cash-flow/categories/bulk-delete",
            json!({ "categoryIds": [category_id] }),
        )
        .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_array().expect("array").len(), 1);
    assert_eq!(body[0]["id"], category_id);

    let (list_status, list_body) = app.get("/api/cash-flow/categories").await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list_body, json!([]));
}

#[tokio::test]
async fn import_categories_returns_imported_categories() {
    let app = CategoryTestApp::new();
    let (status, body) = app
        .post_json(
            "/api/cash-flow/categories/import",
            json!({
                "categories": [
                    { "name": "Food", "color": "#ff0000" },
                    { "name": "Travel", "color": "#0000ff" }
                ]
            }),
        )
        .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_array().expect("array").len(), 2);
}

#[tokio::test]
async fn get_missing_category_returns_not_found_with_message_body() {
    let app = CategoryTestApp::new();
    let (status, body) = app.get("/api/cash-flow/categories/missing-category").await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "notFound");
    assert!(
        body["message"]
            .as_str()
            .expect("message")
            .contains("Failed to get transaction category missing-category")
    );
}

#[tokio::test]
async fn create_category_with_invalid_color_returns_bad_request() {
    let app = CategoryTestApp::new();
    let (status, body) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Food", "color": "red", "role": "spending" }),
        )
        .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "validation");
    assert!(
        body["message"]
            .as_str()
            .expect("message")
            .contains("Failed to create transaction category Food")
    );
}

#[tokio::test]
async fn create_category_with_empty_name_returns_bad_request() {
    let app = CategoryTestApp::new();
    let (status, body) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "   ", "color": "#ff0000", "role": "spending" }),
        )
        .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "validation");
    assert!(
        body["message"]
            .as_str()
            .expect("message")
            .contains("Invalid data")
    );
}

#[tokio::test]
async fn create_duplicate_category_id_returns_conflict() {
    let app = CategoryTestApp::new();
    let fixed_id = "category-fixed-id";
    let first_payload = json!({
        "id": fixed_id,
        "name": "Food",
        "color": "#ff0000",
        "role": "spending"
    });
    let duplicate_payload = json!({
        "id": fixed_id,
        "name": "Travel",
        "color": "#0000ff",
        "role": "spending"
    });

    let (first_status, _) = app
        .post_json("/api/cash-flow/categories", first_payload)
        .await;
    assert_eq!(first_status, StatusCode::CREATED);

    let (status, body) = app
        .post_json("/api/cash-flow/categories", duplicate_payload)
        .await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "conflict");
    assert!(
        body["message"]
            .as_str()
            .expect("message")
            .contains("Failed to create transaction category Travel")
    );
}

#[tokio::test]
async fn delete_category_with_children_using_block_strategy_returns_conflict() {
    let app = CategoryTestApp::new();
    let (_, root) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Food", "color": "#ff0000", "role": "spending" }),
        )
        .await;
    let root_id = root["id"].as_str().expect("root id");
    app.post_json(
        "/api/cash-flow/categories",
        json!({
            "name": "Groceries",
            "parentId": root_id,
            "color": "#00ff00"
        }),
    )
    .await;

    let (status, body) = app
        .post_json(
            "/api/cash-flow/categories/bulk-delete",
            json!({
                "categoryIds": [root_id],
                "childrenStrategy": "block"
            }),
        )
        .await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "conflict");
    assert!(
        body["message"]
            .as_str()
            .expect("message")
            .contains("Failed to delete transaction categories")
    );
}

#[tokio::test]
async fn delete_category_with_children_using_promote_strategy_succeeds() {
    let app = CategoryTestApp::new();
    let (_, root) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({ "name": "Food", "color": "#ff0000", "role": "spending" }),
        )
        .await;
    let root_id = root["id"].as_str().expect("root id");
    let (_, child) = app
        .post_json(
            "/api/cash-flow/categories",
            json!({
                "name": "Groceries",
                "parentId": root_id,
                "color": "#00ff00"
            }),
        )
        .await;
    let child_id = child["id"].as_str().expect("child id");

    let (status, body) = app
        .post_json(
            "/api/cash-flow/categories/bulk-delete",
            json!({
                "categoryIds": [root_id],
                "childrenStrategy": "promote"
            }),
        )
        .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_array().expect("array").len(), 1);

    let (_, promoted_child) = app
        .get(&format!("/api/cash-flow/categories/{child_id}"))
        .await;
    assert!(promoted_child["parentId"].is_null());
}

#[tokio::test]
async fn malformed_json_returns_bad_request_with_message_body() {
    let app = CategoryTestApp::new();
    let (status, body) = app
        .request(
            Request::builder()
                .method("POST")
                .uri("/api/cash-flow/categories")
                .header("content-type", "application/json")
                .body(Body::from("{not-json"))
                .unwrap(),
        )
        .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "validation");
    assert!(body["message"].is_string());
}
