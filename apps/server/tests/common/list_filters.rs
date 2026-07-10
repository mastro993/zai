use axum::http::StatusCode;
use serde_json::{Value, json};

use crate::common::request_json;

pub async fn seed_filter_test_transactions(app: &axum::Router) {
    let (status, _) = request_json(
        app,
        "POST",
        "/api/cash-flow/transactions/import-batch",
        Some(json!({
            "categories": [
                { "id": "food-cat", "name": "Food", "color": "#FF0000" },
                { "id": "travel-cat", "name": "Travel", "color": "#00FF00" }
            ],
            "transactions": [
                {
                    "description": "Morning coffee",
                    "amount": 350,
                    "transactionDate": "2026-07-05T08:00:00",
                    "transactionType": "expense",
                    "transactionCategoryId": "food-cat",
                    "notes": "cafe"
                },
                {
                    "description": "Salary payment",
                    "amount": 500000,
                    "transactionDate": "2026-07-01T12:00:00",
                    "transactionType": "income",
                    "transactionCategoryId": null
                },
                {
                    "description": "Train ticket",
                    "amount": 2500,
                    "transactionDate": "2026-07-15T14:30:00",
                    "transactionType": "expense",
                    "transactionCategoryId": "travel-cat"
                },
                {
                    "description": "Coffee beans",
                    "amount": 1200,
                    "transactionDate": "2026-07-20T10:00:00",
                    "transactionType": "expense",
                    "transactionCategoryId": "food-cat"
                },
                {
                    "description": "Freelance gig",
                    "amount": 80000,
                    "transactionDate": "2026-07-25T16:00:00",
                    "transactionType": "income",
                    "transactionCategoryId": null
                }
            ]
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
}

pub fn transaction_descriptions(body: &Value) -> Vec<String> {
    body["data"]
        .as_array()
        .expect("data array")
        .iter()
        .map(|row| {
            row["description"]
                .as_str()
                .expect("description")
                .to_string()
        })
        .collect()
}

pub fn transaction_field_values(body: &Value, field: &str) -> Vec<String> {
    body["data"]
        .as_array()
        .expect("data array")
        .iter()
        .map(|row| row[field].as_str().expect(field).to_string())
        .collect()
}
