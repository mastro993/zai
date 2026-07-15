mod common;
mod contract_harness;

use axum::http::StatusCode;
use zai_core::features::transaction_categories::models::CategoryRole;

use contract_harness::{
    ContractExpectation, HttpCall, assert_read_parity, category_payload, seed_category,
    setup_contract,
};

#[tokio::test]
async fn category_contract_list_create_and_detail_match_across_transports() {
    let harness = setup_contract("zai-category-contract-lifecycle").await;
    let (status, created) = seed_category(&harness, "Food").await;
    assert_eq!(status, StatusCode::CREATED);
    let category_id = created["id"].as_str().expect("category id");

    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "GET",
                path: "/api/cash-flow/categories".to_string(),
                body: None,
                expected_status: StatusCode::OK,
            },
            compare_body: true,
            expected_error_code: None,
        },
    )
    .await;

    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "GET",
                path: format!("/api/cash-flow/categories/{category_id}"),
                body: None,
                expected_status: StatusCode::OK,
            },
            compare_body: true,
            expected_error_code: None,
        },
    )
    .await;
}

#[tokio::test]
async fn category_contract_validation_and_not_found_match_across_transports() {
    let harness = setup_contract("zai-category-contract-errors").await;
    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "GET",
                path: "/api/cash-flow/categories/missing-category".to_string(),
                body: None,
                expected_status: StatusCode::NOT_FOUND,
            },
            compare_body: false,
            expected_error_code: Some("notFound"),
        },
    )
    .await;

    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "POST",
                path: "/api/cash-flow/categories".to_string(),
                body: Some(category_payload("", CategoryRole::Spending)),
                expected_status: StatusCode::BAD_REQUEST,
            },
            compare_body: false,
            expected_error_code: Some("validation"),
        },
    )
    .await;
}
