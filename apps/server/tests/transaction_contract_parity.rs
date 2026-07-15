mod common;

use axum::http::StatusCode;
use common::{request_json, setup_app};
use serde_json::Value;

async fn tauri_list_transactions(
    context: &std::sync::Arc<zai_app::ServiceContext>,
    path: &str,
) -> Value {
    let mut page = 1_i64;
    let mut per_page = 50_i64;
    if let Some(query) = path.split_once('?').map(|(_, query)| query) {
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
    }

    match context
        .transactions_service()
        .get_transactions(page, per_page, None, None)
    {
        Ok(value) => serde_json::to_value(value).expect("serialize success"),
        Err(error) => serde_json::to_value(error.to_envelope("Failed to load transactions"))
            .expect("serialize error"),
    }
}

#[tokio::test]
async fn transaction_list_paging_validation_matches_across_transports() {
    let (router, context, _dir) = setup_app("zai-transaction-contract-paging").await;
    let path = "/api/cash-flow/transactions?perPage=101";

    let (http_status, http_body) = request_json(&router, "GET", path, None).await;
    assert_eq!(http_status, StatusCode::BAD_REQUEST);
    assert_eq!(http_body["code"], "validation");

    let tauri_body = tauri_list_transactions(&context, path).await;
    assert_eq!(tauri_body["code"], "validation");
    assert_eq!(
        tauri_body.get("details"),
        http_body.get("details"),
        "transport error details should match"
    );
}

#[tokio::test]
async fn transaction_list_paging_overflow_matches_across_transports() {
    let (router, context, _dir) = setup_app("zai-transaction-contract-overflow").await;
    let path = "/api/cash-flow/transactions?page=9223372036854775807&perPage=2";

    let (http_status, http_body) = request_json(&router, "GET", path, None).await;
    assert_eq!(http_status, StatusCode::BAD_REQUEST);
    assert_eq!(http_body["code"], "validation");

    let tauri_body = tauri_list_transactions(&context, path).await;
    assert_eq!(tauri_body["code"], "validation");
}
