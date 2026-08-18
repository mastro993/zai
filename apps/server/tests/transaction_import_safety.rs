mod common;

use axum::http::StatusCode;
use common::{preview_and_commit_import, request_json, setup_app, test_now};
use serde_json::{Value, json};

async fn create_category(
    app: &axum::Router,
    name: &str,
    parent_id: Option<&str>,
    role: Option<&str>,
) -> Value {
    let mut payload = json!({
        "name": name,
        "parentId": parent_id,
        "color": null,
    });
    if let Some(role) = role {
        payload["role"] = json!(role);
    }

    let (status, category) = request_json(app, "POST", "/api/categories", Some(payload)).await;
    assert_eq!(status, StatusCode::CREATED);
    category
}

#[tokio::test]
async fn bound_import_skips_blank_category_names_without_persisting_them() {
    let (app, _context, _dir) = setup_app("zai-transaction-import-invalid-category").await;

    let (status, _) = preview_and_commit_import(
        &app,
        "digest-blank-category",
        false,
        Some("EUR"),
        json!([{
            "rowNumber": 2,
            "date": "2026-07-09T12:30:00",
            "amountMinor": 500,
            "transactionType": "expense",
            "description": "No category",
            "category": "   "
        }]),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, categories) = request_json(&app, "GET", "/api/categories", None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(categories.as_array().expect("categories").is_empty());
}

#[tokio::test]
async fn bound_import_child_inherits_existing_income_root_role() {
    let (app, _context, _dir) = setup_app("zai-transaction-import-inherited-role").await;
    let root = create_category(&app, "Income", None, Some("income")).await;
    let transaction_date = test_now().format("%Y-%m-%dT%H:%M:%S").to_string();

    let (status, imported) = preview_and_commit_import(
        &app,
        "digest-bonus",
        false,
        Some("EUR"),
        json!([{
            "rowNumber": 2,
            "date": transaction_date,
            "amountMinor": 500,
            "transactionType": "income",
            "description": "Bonus payment",
            "parentCategory": "Income",
            "category": "Bonus"
        }]),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let child_id = imported["transactions"][0]["transactionCategoryId"]
        .as_str()
        .expect("child id");

    let (status, child) =
        request_json(&app, "GET", &format!("/api/categories/{child_id}"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(child["role"], "income");
    assert_eq!(child["parentId"], root["id"]);

    let (status, budget) = request_json(
        &app,
        "POST",
        "/api/budgets",
        Some(json!({
            "name": "Income-only spending budget",
            "baseAllowance": 1000,
            "categoryIds": [child_id],
            "measurementMode": "spending"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(budget["currentPeriod"]["netBudgetSpending"], 0);
}

#[tokio::test]
async fn category_api_still_rejects_third_level_without_mutation() {
    let (app, _context, _dir) = setup_app("zai-transaction-import-depth").await;
    let root = create_category(&app, "Food", None, Some("spending")).await;
    let root_id = root["id"].as_str().expect("root id");
    let child = create_category(&app, "Groceries", Some(root_id), None).await;
    let child_id = child["id"].as_str().expect("child id");

    let (status, body) = request_json(
        &app,
        "POST",
        "/api/categories",
        Some(json!({
            "parentId": child_id,
            "name": "Fresh",
            "color": null
        })),
    )
    .await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "conflict");
}
