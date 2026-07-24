mod common;

use axum::http::StatusCode;
use common::{request_json, setup_app, test_now};
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

    let (status, category) =
        request_json(app, "POST", "/api/cash-flow/categories", Some(payload)).await;
    assert_eq!(status, StatusCode::CREATED);
    category
}

#[tokio::test]
async fn transaction_batch_rejects_blank_category_without_persisting_it() {
    let (app, _context, _dir) = setup_app("zai-transaction-import-invalid-category").await;

    let (status, body) = request_json(
        &app,
        "POST",
        "/api/cash-flow/transactions/import-batch",
        Some(json!({
            "categories": [{
                "id": "blank-category",
                "name": "   ",
                "color": "#FF0000"
            }],
            "transactions": []
        })),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "validation");

    let (status, categories) = request_json(&app, "GET", "/api/cash-flow/categories", None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(categories.as_array().expect("categories").is_empty());
}

#[tokio::test]
async fn transaction_batch_child_inherits_existing_income_root_role() {
    let (app, _context, _dir) = setup_app("zai-transaction-import-inherited-role").await;
    let root = create_category(&app, "Income", None, Some("income")).await;
    let root_id = root["id"].as_str().expect("root id");
    let transaction_date = test_now().format("%Y-%m-%dT%H:%M:%S").to_string();

    let (status, _) = request_json(
        &app,
        "POST",
        "/api/cash-flow/transactions/import-batch",
        Some(json!({
            "categories": [{
                "id": "bonus-child",
                "parentId": root_id,
                "name": "Bonus",
                "color": null
            }],
            "transactions": [{
                "id": "income-transaction",
                "description": "Bonus payment",
                "amount": 500,
                "transactionDate": transaction_date,
                "transactionType": "income",
                "transactionCategoryId": "bonus-child"
            }]
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, child) =
        request_json(&app, "GET", "/api/cash-flow/categories/bonus-child", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(child["role"], "income");

    let (status, budget) = request_json(
        &app,
        "POST",
        "/api/cash-flow/budgets",
        Some(json!({
            "name": "Income-only spending budget",
            "baseAllowance": 1000,
            "categoryIds": ["bonus-child"],
            "measurementMode": "spending"
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(budget["currentPeriod"]["netBudgetSpending"], 0);
}

#[tokio::test]
async fn transaction_batch_rejects_third_category_level_without_mutation() {
    let (app, _context, _dir) = setup_app("zai-transaction-import-depth").await;
    let root = create_category(&app, "Food", None, Some("spending")).await;
    let root_id = root["id"].as_str().expect("root id");
    let child = create_category(&app, "Groceries", Some(root_id), None).await;
    let child_id = child["id"].as_str().expect("child id");

    let (status, body) = request_json(
        &app,
        "POST",
        "/api/cash-flow/transactions/import-batch",
        Some(json!({
            "categories": [{
                "id": "forbidden-third-level",
                "parentId": child_id,
                "name": "Fresh",
                "color": null
            }],
            "transactions": []
        })),
    )
    .await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "conflict");

    let (status, _) = request_json(
        &app,
        "GET",
        "/api/cash-flow/categories/forbidden-third-level",
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}
