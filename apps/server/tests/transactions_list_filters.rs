mod common;

#[path = "common/list_filters.rs"]
mod list_filters;

use axum::http::StatusCode;
use common::{request_json, setup_app};
use list_filters::{
    seed_filter_test_transactions, transaction_descriptions, transaction_field_values,
};

#[tokio::test]
async fn list_transactions_pagination_respects_page_and_per_page() {
    let (app, _context, _dir) = setup_app("zai-transactions-list").await;
    seed_filter_test_transactions(&app).await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?page=2&perPage=2",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["page"], 2);
    assert_eq!(body["perPage"], 2);
    assert_eq!(body["totalPages"], 3);
    assert_eq!(body["data"].as_array().expect("data").len(), 2);
}

#[tokio::test]
async fn list_transactions_filters_by_text_search() {
    let (app, _context, _dir) = setup_app("zai-transactions-list").await;
    seed_filter_test_transactions(&app).await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?query=coffee",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let descriptions = transaction_descriptions(&body);
    assert_eq!(descriptions.len(), 2);
    assert!(descriptions.contains(&"Morning coffee".to_string()));
    assert!(descriptions.contains(&"Coffee beans".to_string()));
}

#[tokio::test]
async fn list_transactions_filters_by_transaction_type() {
    let (app, _context, _dir) = setup_app("zai-transactions-list").await;
    seed_filter_test_transactions(&app).await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?transactionType=income",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let rows = body["data"].as_array().expect("data");
    assert_eq!(rows.len(), 2);
    assert!(rows.iter().all(|row| row["transactionType"] == "income"));
}

#[tokio::test]
async fn list_transactions_filters_by_date_range() {
    let (app, _context, _dir) = setup_app("zai-transactions-list").await;
    seed_filter_test_transactions(&app).await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?startDate=2026-07-10T00%3A00%3A00&endDate=2026-07-18T23%3A59%3A59",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        transaction_descriptions(&body),
        vec!["Train ticket".to_string()]
    );
}

#[tokio::test]
async fn list_transactions_filters_by_single_category() {
    let (app, _context, _dir) = setup_app("zai-transactions-list").await;
    seed_filter_test_transactions(&app).await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?categoryId=food-cat",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let descriptions = transaction_descriptions(&body);
    assert_eq!(descriptions.len(), 2);
    assert!(descriptions.contains(&"Morning coffee".to_string()));
    assert!(descriptions.contains(&"Coffee beans".to_string()));
}

#[tokio::test]
async fn list_transactions_filters_by_multiple_categories() {
    let (app, _context, _dir) = setup_app("zai-transactions-list").await;
    seed_filter_test_transactions(&app).await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?categoryId=food-cat&categoryId=travel-cat",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(transaction_descriptions(&body).len(), 3);
}

#[tokio::test]
async fn list_transactions_filters_uncategorized_only() {
    let (app, _context, _dir) = setup_app("zai-transactions-list").await;
    seed_filter_test_transactions(&app).await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?uncategorized=true",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let rows = body["data"].as_array().expect("data");
    assert_eq!(rows.len(), 2);
    assert!(
        rows.iter()
            .all(|row| row["transactionCategoryId"].is_null())
    );
}

#[tokio::test]
async fn list_transactions_sorts_by_amount_desc() {
    let (app, _context, _dir) = setup_app("zai-transactions-list").await;
    seed_filter_test_transactions(&app).await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?sortField=amount&sortDesc=true",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let amounts: Vec<i64> = body["data"]
        .as_array()
        .expect("data")
        .iter()
        .map(|row| row["amount"].as_i64().expect("amount"))
        .collect();
    assert_eq!(amounts, vec![500000, 80000, 2500, 1200, 350]);
}

#[tokio::test]
async fn list_transactions_sorts_by_amount_asc() {
    let (app, _context, _dir) = setup_app("zai-transactions-list").await;
    seed_filter_test_transactions(&app).await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?sortField=amount&sortDesc=false",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let amounts: Vec<i64> = body["data"]
        .as_array()
        .expect("data")
        .iter()
        .map(|row| row["amount"].as_i64().expect("amount"))
        .collect();
    assert_eq!(amounts, vec![350, 1200, 2500, 80000, 500000]);
}

#[tokio::test]
async fn list_transactions_sorts_by_date_desc() {
    let (app, _context, _dir) = setup_app("zai-transactions-list").await;
    seed_filter_test_transactions(&app).await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?sortField=date&sortDesc=true",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        transaction_descriptions(&body),
        vec![
            "Freelance gig".to_string(),
            "Coffee beans".to_string(),
            "Train ticket".to_string(),
            "Morning coffee".to_string(),
            "Salary payment".to_string(),
        ]
    );
}

#[tokio::test]
async fn list_transactions_sorts_by_description_asc() {
    let (app, _context, _dir) = setup_app("zai-transactions-list").await;
    seed_filter_test_transactions(&app).await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?sortField=description&sortDesc=false",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        transaction_descriptions(&body),
        vec![
            "Coffee beans".to_string(),
            "Freelance gig".to_string(),
            "Morning coffee".to_string(),
            "Salary payment".to_string(),
            "Train ticket".to_string(),
        ]
    );
}

#[tokio::test]
async fn list_transactions_sorts_by_type_desc() {
    let (app, _context, _dir) = setup_app("zai-transactions-list").await;
    seed_filter_test_transactions(&app).await;

    let (status, body) = request_json(
        &app,
        "GET",
        "/api/cash-flow/transactions?sortField=type&sortDesc=true",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        transaction_field_values(&body, "transactionType"),
        vec![
            "income".to_string(),
            "income".to_string(),
            "expense".to_string(),
            "expense".to_string(),
            "expense".to_string(),
        ]
    );
}
