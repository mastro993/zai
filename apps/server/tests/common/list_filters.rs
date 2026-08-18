use axum::http::StatusCode;
use serde_json::{Value, json};

use crate::common::{import_categories, request_json};

pub async fn seed_filter_test_transactions(app: &axum::Router) {
    let (status, _) = import_categories(
        app,
        json!([
            { "id": "11111111-1111-1111-1111-111111111111", "name": "Food", "color": "#FF0000" },
            { "id": "22222222-2222-2222-2222-222222222222", "name": "Travel", "color": "#00FF00" }
        ]),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let transactions = [
        json!({
            "description": "Morning coffee",
            "amount": 350,
            "currency": "EUR",
            "transactionDate": "2026-07-05T08:00:00",
            "transactionType": "expense",
            "transactionCategoryId": "11111111-1111-1111-1111-111111111111",
            "notes": "cafe"
        }),
        json!({
            "description": "Salary payment",
            "amount": 500000,
            "currency": "EUR",
            "transactionDate": "2026-07-01T12:00:00",
            "transactionType": "income",
            "transactionCategoryId": null
        }),
        json!({
            "description": "Train ticket",
            "amount": 2500,
            "currency": "EUR",
            "transactionDate": "2026-07-15T14:30:00",
            "transactionType": "expense",
            "transactionCategoryId": "22222222-2222-2222-2222-222222222222"
        }),
        json!({
            "description": "Coffee beans",
            "amount": 1200,
            "currency": "EUR",
            "transactionDate": "2026-07-20T10:00:00",
            "transactionType": "expense",
            "transactionCategoryId": "11111111-1111-1111-1111-111111111111"
        }),
        json!({
            "description": "Freelance gig",
            "amount": 80000,
            "currency": "EUR",
            "transactionDate": "2026-07-25T16:00:00",
            "transactionType": "income",
            "transactionCategoryId": null
        }),
    ];

    for payload in transactions {
        let (status, _) = request_json(app, "POST", "/api/transactions", Some(payload)).await;
        assert_eq!(status, StatusCode::CREATED);
    }
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
