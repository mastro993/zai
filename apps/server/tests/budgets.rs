mod common;

use axum::http::StatusCode;
use chrono::Local;
use common::{request_json, setup_app};
use serde_json::{Value, json};

fn budget_payload(name: &str) -> Value {
    json!({
        "name": name,
        "baseAllowance": 10000
    })
}

#[tokio::test]
async fn create_list_and_inspect_budget_round_trip() {
    let (app, _context, _dir) = setup_app("zai-budgets").await;
    let transaction_date = Local::now().format("%Y-%m-%dT12:00:00").to_string();

    let (transaction_status, _) = request_json(
        &app,
        "POST",
        "/api/cash-flow/transactions",
        Some(json!({
            "description": "Before budget",
            "amount": 1250,
            "transactionDate": transaction_date,
            "transactionType": "expense"
        })),
    )
    .await;
    assert_eq!(transaction_status, StatusCode::CREATED);

    let (create_status, created) = request_json(
        &app,
        "POST",
        "/api/cash-flow/budgets",
        Some(budget_payload("  Monthly spending  ")),
    )
    .await;

    assert_eq!(create_status, StatusCode::CREATED);
    assert_eq!(created["name"], "Monthly spending");
    assert!(created["id"].as_str().is_some_and(|id| !id.is_empty()));
    assert_eq!(created["cadence"], "month");
    assert_eq!(created["measurementMode"], "spending");
    assert_eq!(created["warningPercentage"], 80);
    assert_eq!(created["categoryIds"], json!([]));
    assert_eq!(created["currentPeriod"]["netBudgetSpending"], 1250);
    assert_eq!(created["currentPeriod"]["remainingAllowance"], 8750);

    let budget_id = created["id"].as_str().expect("budget id");
    let (list_status, listed) = request_json(&app, "GET", "/api/cash-flow/budgets", None).await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(listed.as_array().expect("budget list").len(), 1);
    assert_eq!(listed[0]["id"], budget_id);

    let (detail_status, detail) = request_json(
        &app,
        "GET",
        &format!("/api/cash-flow/budgets/{budget_id}"),
        None,
    )
    .await;
    assert_eq!(detail_status, StatusCode::OK);
    assert_eq!(detail, created);

    let (history_status, history) = request_json(
        &app,
        "GET",
        &format!("/api/cash-flow/budgets/{budget_id}/history"),
        None,
    )
    .await;
    assert_eq!(history_status, StatusCode::OK);
    assert_eq!(history["page"], 1);
    assert_eq!(history["perPage"], 50);
    assert_eq!(history["totalPages"], 1);
    assert_eq!(history["data"].as_array().expect("history rows").len(), 1);
}

#[tokio::test]
async fn duplicate_active_budget_name_returns_name_conflict() {
    let (app, _context, _dir) = setup_app("zai-budget-conflict").await;
    let (first_status, _) = request_json(
        &app,
        "POST",
        "/api/cash-flow/budgets",
        Some(budget_payload("Monthly")),
    )
    .await;
    assert_eq!(first_status, StatusCode::CREATED);

    let (status, body) = request_json(
        &app,
        "POST",
        "/api/cash-flow/budgets",
        Some(budget_payload(" monthly ")),
    )
    .await;

    assert_eq!(status, StatusCode::CONFLICT, "body: {body}");
    assert_eq!(body["code"], "nameConflict");
}

#[tokio::test]
async fn update_budget_replaces_open_configuration_and_rejects_stale_revision() {
    let (app, _context, _dir) = setup_app("zai-budget-update").await;
    let (_, created) = request_json(
        &app,
        "POST",
        "/api/cash-flow/budgets",
        Some(budget_payload("Monthly")),
    )
    .await;
    let budget_id = created["id"].as_str().expect("budget id");

    let (status, updated) = request_json(
        &app,
        "PUT",
        &format!("/api/cash-flow/budgets/{budget_id}"),
        Some(json!({
            "expectedRevision": created["revision"],
            "name": "Updated monthly",
            "baseAllowance": 20000,
            "cadence": "month",
            "categoryIds": [],
            "measurementMode": "spending",
            "rolloverMode": "off",
            "warningPercentage": 80
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated["name"], "Updated monthly");
    assert_eq!(updated["revision"], 1);
    assert_eq!(updated["currentPeriod"]["baseAllowance"], 20000);

    let (status, conflict) = request_json(
        &app,
        "PUT",
        &format!("/api/cash-flow/budgets/{budget_id}"),
        Some(json!({
            "expectedRevision": 0,
            "name": "Stale",
            "baseAllowance": 30000,
            "cadence": "month",
            "categoryIds": [],
            "measurementMode": "spending",
            "rolloverMode": "off",
            "warningPercentage": 80
        })),
    )
    .await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(conflict["code"], "revisionConflict");
    assert_eq!(conflict["details"]["currentRevision"], 1);
}

#[tokio::test]
async fn update_budget_rejects_cadence_changes() {
    let (app, _context, _dir) = setup_app("zai-budget-cadence-lock").await;
    let (_, created) = request_json(
        &app,
        "POST",
        "/api/cash-flow/budgets",
        Some(budget_payload("Monthly")),
    )
    .await;
    let budget_id = created["id"].as_str().expect("budget id");

    let (status, body) = request_json(
        &app,
        "PUT",
        &format!("/api/cash-flow/budgets/{budget_id}"),
        Some(json!({
            "expectedRevision": 0,
            "name": "Monthly",
            "baseAllowance": 10000,
            "cadence": "week",
            "categoryIds": [],
            "measurementMode": "spending",
            "rolloverMode": "off",
            "warningPercentage": 80
        })),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "validation");
}

#[tokio::test]
async fn pause_and_resume_keep_budget_history_without_active_list_gaps() {
    let (app, _context, _dir) = setup_app("zai-budget-lifecycle").await;
    let (_, created) = request_json(
        &app,
        "POST",
        "/api/cash-flow/budgets",
        Some(budget_payload("Lifecycle")),
    )
    .await;
    let budget_id = created["id"].as_str().expect("budget id");

    let (pause_status, paused) = request_json(
        &app,
        "POST",
        &format!("/api/cash-flow/budgets/{budget_id}/pause"),
        Some(json!({ "expectedRevision": created["revision"] })),
    )
    .await;
    assert_eq!(pause_status, StatusCode::OK);
    assert_eq!(paused["paused"], true);
    assert_eq!(paused["revision"], 1);

    let (active_status, active) = request_json(&app, "GET", "/api/cash-flow/budgets", None).await;
    assert_eq!(active_status, StatusCode::OK);
    assert_eq!(active.as_array().expect("active list").len(), 0);

    let (paused_status, paused_list) =
        request_json(&app, "GET", "/api/cash-flow/budgets?filter=paused", None).await;
    assert_eq!(paused_status, StatusCode::OK);
    assert_eq!(paused_list.as_array().expect("paused list").len(), 1);

    let (all_status, all) =
        request_json(&app, "GET", "/api/cash-flow/budgets?filter=all", None).await;
    assert_eq!(all_status, StatusCode::OK);
    assert_eq!(all.as_array().expect("all list").len(), 1);

    let (resume_status, resumed) = request_json(
        &app,
        "POST",
        &format!("/api/cash-flow/budgets/{budget_id}/resume"),
        Some(json!({ "expectedRevision": paused["revision"] })),
    )
    .await;
    assert_eq!(resume_status, StatusCode::OK);
    assert_eq!(resumed["paused"], false);
    assert_eq!(resumed["revision"], 2);
}

#[tokio::test]
async fn delete_budget_returns_no_content_is_idempotent_and_releases_name() {
    let (app, _context, _dir) = setup_app("zai-budget-delete").await;
    let (_, created) = request_json(
        &app,
        "POST",
        "/api/cash-flow/budgets",
        Some(budget_payload("Deletable")),
    )
    .await;
    let budget_id = created["id"].as_str().expect("budget id");

    let (status, body) = request_json(
        &app,
        "DELETE",
        &format!("/api/cash-flow/budgets/{budget_id}"),
        Some(json!({ "expectedRevision": created["revision"] })),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(body, Value::Null);

    let (list_status, list) =
        request_json(&app, "GET", "/api/cash-flow/budgets?filter=all", None).await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list, json!([]));

    let (detail_status, detail) = request_json(
        &app,
        "GET",
        &format!("/api/cash-flow/budgets/{budget_id}"),
        None,
    )
    .await;
    assert_eq!(detail_status, StatusCode::NOT_FOUND);
    assert_eq!(detail["code"], "notFound");

    let (retry_status, retry_body) = request_json(
        &app,
        "DELETE",
        &format!("/api/cash-flow/budgets/{budget_id}"),
        Some(json!({ "expectedRevision": created["revision"] })),
    )
    .await;
    assert_eq!(retry_status, StatusCode::NO_CONTENT);
    assert_eq!(retry_body, Value::Null);

    let (_, replacement) = request_json(
        &app,
        "POST",
        "/api/cash-flow/budgets",
        Some(budget_payload("Deletable")),
    )
    .await;
    assert_ne!(replacement["id"], budget_id);
}

#[tokio::test]
async fn delete_budget_rejects_stale_revision() {
    let (app, _context, _dir) = setup_app("zai-budget-delete-revision").await;
    let (_, created) = request_json(
        &app,
        "POST",
        "/api/cash-flow/budgets",
        Some(budget_payload("Revision")),
    )
    .await;
    let budget_id = created["id"].as_str().expect("budget id");

    let (status, body) = request_json(
        &app,
        "DELETE",
        &format!("/api/cash-flow/budgets/{budget_id}"),
        Some(json!({ "expectedRevision": 1 })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["code"], "revisionConflict");
    assert_eq!(body["details"]["currentRevision"], 0);
}

#[tokio::test]
async fn create_budget_accepts_cadence_scope_and_measurement_mode() {
    let (app, _context, _dir) = setup_app("zai-budget-options").await;
    let (category_status, category) = request_json(
        &app,
        "POST",
        "/api/cash-flow/categories",
        Some(json!({
            "name": "Groceries",
            "role": "spending"
        })),
    )
    .await;
    assert_eq!(category_status, StatusCode::CREATED);
    let category_id = category["id"].as_str().expect("category id");

    let (status, budget) = request_json(
        &app,
        "POST",
        "/api/cash-flow/budgets",
        Some(json!({
            "name": "Weekly cash flow",
            "baseAllowance": 10000,
            "cadence": "week",
            "categoryIds": [category_id],
            "measurementMode": "netCashFlow"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(budget["cadence"], "week");
    assert_eq!(budget["categoryIds"], json!([category_id]));
    assert_eq!(budget["measurementMode"], "netCashFlow");
}

#[tokio::test]
async fn budget_history_rejects_invalid_page_size() {
    let (app, _context, _dir) = setup_app("zai-budget-history-validation").await;
    let (_, budget) = request_json(
        &app,
        "POST",
        "/api/cash-flow/budgets",
        Some(budget_payload("History")),
    )
    .await;
    let budget_id = budget["id"].as_str().expect("budget id");

    let (status, body) = request_json(
        &app,
        "GET",
        &format!("/api/cash-flow/budgets/{budget_id}/history?perPage=101"),
        None,
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "validation");

    let (status, body) = request_json(
        &app,
        "GET",
        &format!("/api/cash-flow/budgets/{budget_id}/history?page=not-a-number"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "validation");
}
