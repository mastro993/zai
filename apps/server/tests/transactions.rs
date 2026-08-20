mod common;

use axum::http::StatusCode;
use common::{import_categories, preview_and_commit_import, request_json, setup_app};
use serde_json::{Value, json};
use tower::ServiceExt;

fn sample_transaction_payload() -> Value {
    json!({
        "description": "Coffee",
        "amount": 350,
        "currency": "EUR",
        "transactionDate": "2026-07-09T12:30:00",
        "transactionType": "expense",
        "transactionCategoryId": null,
        "notes": "Morning coffee"
    })
}

#[tokio::test]
async fn list_transactions_returns_paginated_defaults() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    let (status, body) = request_json(&app, "GET", "/api/transactions", None).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["page"], 1);
    assert_eq!(body["perPage"], 50);
    assert!(body["data"].is_array());
}

#[tokio::test]
async fn list_transactions_rejects_invalid_paging_values() {
    let (app, _context, _dir) = setup_app("zai-transactions-paging").await;

    for uri in [
        "/api/transactions?page=0",
        "/api/transactions?page=-1",
        "/api/transactions?perPage=0",
        "/api/transactions?perPage=-5",
        "/api/transactions?perPage=101",
        "/api/transactions?page=9223372036854775807&perPage=2",
    ] {
        let (status, body) = request_json(&app, "GET", uri, None).await;

        assert_eq!(
            status,
            StatusCode::BAD_REQUEST,
            "expected rejection for {uri}"
        );
        assert_eq!(body["code"], "validation");
        assert!(
            body["message"]
                .as_str()
                .expect("message")
                .contains("Failed to load transactions")
        );
    }
}

#[tokio::test]
async fn list_transactions_accepts_boundary_paging_values() {
    let (app, _context, _dir) = setup_app("zai-transactions-paging-boundary").await;

    for uri in [
        "/api/transactions?page=1&perPage=1",
        "/api/transactions?page=1&perPage=100",
    ] {
        let (status, body) = request_json(&app, "GET", uri, None).await;

        assert_eq!(status, StatusCode::OK, "expected success for {uri}");
        assert!(body["data"].is_array());
    }
}

#[tokio::test]
async fn list_transactions_rejects_uncategorized_with_category_filters() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/transactions?uncategorized=true&categoryId=cat-1",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "validation");
    assert_eq!(
        body["message"],
        "Choose either category filters or uncategorized only"
    );
}

#[tokio::test]
async fn create_transaction_with_category_succeeds() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    let (batch_status, _) = import_categories(
        &app,
        json!([{ "id": "11111111-1111-1111-1111-111111111111", "name": "Food", "color": "#FF0000" }]),
    )
    .await;
    assert_eq!(batch_status, StatusCode::OK);

    let (status, created) = request_json(
        &app,
        "POST",
        "/api/transactions",
        Some(json!({
            "description": "Dinner",
            "amount": 1500,
            "currency": "EUR",
            "transactionDate": "2026-07-10T19:00:00",
            "transactionType": "expense",
            "transactionCategoryId": "11111111-1111-1111-1111-111111111111"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(
        created["transactionCategoryId"],
        "11111111-1111-1111-1111-111111111111"
    );
}

#[tokio::test]
async fn create_get_update_delete_transaction_round_trip() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    let (create_status, created) = request_json(
        &app,
        "POST",
        "/api/transactions",
        Some(sample_transaction_payload()),
    )
    .await;

    assert_eq!(create_status, StatusCode::CREATED);
    assert_eq!(created["description"], "Coffee");
    assert_eq!(created["amount"], 350);
    assert_eq!(created["currency"], "EUR");
    assert_eq!(created["transactionType"], "expense");
    assert_eq!(created["complete"], true);
    assert_eq!(created["convertedAmount"], 350);
    assert_eq!(created["convertedCurrency"], "EUR");
    assert_eq!(created["exchangeRate"]["variant"], "identity");

    let transaction_id = created["id"].as_str().expect("created id");

    let (get_status, fetched) = request_json(
        &app,
        "GET",
        &format!("/api/transactions/{transaction_id}"),
        None,
    )
    .await;
    assert_eq!(get_status, StatusCode::OK);
    assert_eq!(fetched["id"], transaction_id);

    let (update_status, updated) = request_json(
        &app,
        "PUT",
        &format!("/api/transactions/{transaction_id}"),
        Some(json!({
            "description": "Updated coffee",
            "amount": 400,
            "currency": "EUR",
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
        &format!("/api/transactions/{transaction_id}"),
        None,
    )
    .await;
    assert_eq!(delete_status, StatusCode::OK);
    assert_eq!(deleted["id"], transaction_id);

    let (missing_status, missing_body) = request_json(
        &app,
        "GET",
        &format!("/api/transactions/{transaction_id}"),
        None,
    )
    .await;
    assert_eq!(missing_status, StatusCode::NOT_FOUND);
    assert_eq!(missing_body["code"], "notFound");
    assert!(
        missing_body["message"]
            .as_str()
            .expect("message")
            .contains("Failed to load transaction")
    );
}

#[tokio::test]
async fn bulk_delete_transactions_returns_deleted_rows() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    let mut ids = Vec::new();
    for description in ["One", "Two"] {
        let (_, created) = request_json(
            &app,
            "POST",
            "/api/transactions",
            Some(json!({
                "description": description,
                "amount": 100,
                "currency": "EUR",
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
        "/api/transactions/bulk-delete",
        Some(json!({ "transactionIds": ids })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let rows = deleted.as_array().expect("array");
    assert_eq!(rows.len(), 2);
    for row in rows {
        assert_eq!(row["amount"], 100);
        assert_eq!(row["currency"], "EUR");
        assert!(row.get("exchangeRate").is_none());
        assert!(row.get("convertedAmount").is_some());
        assert!(row.get("convertedCurrency").is_some());
        assert!(row.get("complete").is_some());
    }
}

#[tokio::test]
async fn create_transaction_rejects_invalid_type() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    let (status, body) = request_json(
        &app,
        "POST",
        "/api/transactions",
        Some(json!({
            "description": "Bad",
            "amount": 100,
            "currency": "EUR",
            "transactionDate": "2026-07-09T12:30:00",
            "transactionType": "transfer"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "validation");
    assert!(
        body["message"]
            .as_str()
            .expect("message")
            .contains("Failed to create transaction")
    );
}

#[tokio::test]
async fn create_transaction_returns_conflict_for_missing_category() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    let (status, body) = request_json(
        &app,
        "POST",
        "/api/transactions",
        Some(json!({
            "description": "Categorized",
            "amount": 100,
            "currency": "EUR",
            "transactionDate": "2026-07-09T12:30:00",
            "transactionType": "expense",
            "transactionCategoryId": "missing-category"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "conflict");
    assert!(body["message"].is_string());
}

#[tokio::test]
async fn removed_import_routes_return_not_found() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    for path in ["/api/transactions/import", "/api/transactions/import-batch"] {
        let (status, _) =
            request_json(&app, "POST", path, Some(json!({ "transactions": [] }))).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }
}

#[tokio::test]
async fn preview_and_commit_import_returns_imported_rows() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    let (status, imported) = preview_and_commit_import(
        &app,
        "digest-imported",
        false,
        Some("EUR"),
        json!([{
            "rowNumber": 2,
            "date": "2026-07-09T12:30:00",
            "amountMinor": 500,
            "currency": "EUR",
            "transactionType": "expense",
            "description": "Imported"
        }]),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(imported["transactions"].as_array().expect("array").len(), 1);
}

#[tokio::test]
async fn preview_and_commit_creates_named_categories() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    let (status, imported) = preview_and_commit_import(
        &app,
        "digest-lunch",
        false,
        Some("EUR"),
        json!([{
            "rowNumber": 2,
            "date": "2026-07-09T12:30:00",
            "amountMinor": 1200,
            "transactionType": "expense",
            "description": "Lunch",
            "category": "Food"
        }]),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(imported["transactions"].as_array().expect("array").len(), 1);
    assert_eq!(imported["transactions"][0]["description"], "Lunch");
}

#[tokio::test]
async fn stale_import_preview_returns_conflict() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    let (status, preview) = common::preview_transaction_import(
        &app,
        "digest-stale",
        false,
        Some("EUR"),
        json!([{
            "rowNumber": 2,
            "date": "2026-07-09T12:30:00",
            "amountMinor": 500,
            "transactionType": "expense",
            "description": "Imported"
        }]),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let token = preview["token"].as_str().expect("token");

    let (status, body) = common::commit_transaction_import(&app, token, "other-digest").await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "staleImportPreview");
}

#[tokio::test]
async fn invalid_preview_rows_block_commit() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    let (status, body) = preview_and_commit_import(
        &app,
        "digest-invalid",
        true,
        None,
        json!([{
            "rowNumber": 2,
            "date": "2026-07-09T12:30:00",
            "amountMinor": 500,
            "transactionType": "expense",
            "description": "Missing currency"
        }]),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "validation");
}

#[tokio::test]
async fn malformed_json_returns_bad_request_message_body() {
    let (app, _context, _dir) = setup_app("zai-transactions").await;

    let request = axum::http::Request::builder()
        .method("POST")
        .uri("/api/transactions")
        .header("content-type", "application/json")
        .body(axum::body::Body::from("{not-json"))
        .expect("request should build");

    let response = app.oneshot(request).await.expect("request should succeed");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body should read");
    let body: Value = serde_json::from_slice(&bytes).expect("json body");
    assert_eq!(body["code"], "validation");
    assert!(body["message"].is_string());
}
