#![allow(dead_code, unused_imports)]

mod helpers;
mod normalize;
mod recurring;
mod seeds;

use std::sync::Arc;

use axum::http::StatusCode;
use serde_json::Value;
use zai_app::ServiceContext;

use crate::common::{TempAppDataDir, request_json};

pub use seeds::{seed_alert, seed_category, seed_transaction};

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
    normalize::normalize_response_body(&mut http_normalized);
    normalize::normalize_response_body(&mut tauri_normalized);

    assert_eq!(
        tauri_normalized, http_normalized,
        "transport bodies diverged for {} {}",
        expectation.http.method, expectation.http.path
    );
}

pub async fn run_tauri_for_http(context: &ServiceContext, call: &HttpCall) -> Value {
    dispatch::run_tauri_for_http(context, call).await
}

mod dispatch;
