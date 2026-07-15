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

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempAppDataDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

pub async fn setup_app(
    prefix: &str,
) -> (axum::Router, Arc<zai_app::ServiceContext>, TempAppDataDir) {
    let app_data_dir = TempAppDataDir::new(prefix);
    let context = Arc::new(
        initialize_context(app_data_dir.path()).expect("shared context should initialize"),
    );
    (create_router(Arc::clone(&context)), context, app_data_dir)
}

pub async fn request_json(
    app: &axum::Router,
    method: &str,
    uri: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    request_json_with_headers(app, method, uri, body, None).await
}

pub async fn request_json_with_headers(
    app: &axum::Router,
    method: &str,
    uri: &str,
    body: Option<Value>,
    origin: Option<&str>,
) -> (StatusCode, Value) {
    let is_mutation = matches!(method, "POST" | "PUT" | "PATCH" | "DELETE");
    let body = if is_mutation {
        Some(body.unwrap_or_else(|| json!({})))
    } else {
        body
    };

    let mut request_builder = Request::builder().method(method).uri(uri);

    if let Some(origin) = origin {
        request_builder = request_builder.header("Origin", origin);
    }

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
