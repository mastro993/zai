mod common;
mod contract_harness;

use axum::http::StatusCode;

use contract_harness::{
    ContractExpectation, HttpCall, assert_read_parity, seed_transaction, setup_contract,
};

#[tokio::test]
async fn transaction_contract_list_create_and_detail_match_across_transports() {
    let harness = setup_contract("zai-transaction-contract-lifecycle").await;
    let (status, created) = seed_transaction(&harness, "Coffee").await;
    assert_eq!(status, StatusCode::CREATED);
    let transaction_id = created["id"].as_str().expect("transaction id");

    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "GET",
                path: "/api/cash-flow/transactions".to_string(),
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
                path: format!("/api/cash-flow/transactions/{transaction_id}"),
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
async fn transaction_list_paging_validation_matches_across_transports() {
    let harness = setup_contract("zai-transaction-contract-paging").await;
    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "GET",
                path: "/api/cash-flow/transactions?perPage=101".to_string(),
                body: None,
                expected_status: StatusCode::BAD_REQUEST,
            },
            compare_body: false,
            expected_error_code: Some("validation"),
        },
    )
    .await;
}

#[tokio::test]
async fn transaction_list_paging_overflow_matches_across_transports() {
    let harness = setup_contract("zai-transaction-contract-overflow").await;
    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "GET",
                path: "/api/cash-flow/transactions?page=9223372036854775807&perPage=2".to_string(),
                body: None,
                expected_status: StatusCode::BAD_REQUEST,
            },
            compare_body: false,
            expected_error_code: Some("validation"),
        },
    )
    .await;
}

#[tokio::test]
async fn transaction_contract_not_found_matches_across_transports() {
    let harness = setup_contract("zai-transaction-contract-not-found").await;
    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "GET",
                path: "/api/cash-flow/transactions/missing-transaction".to_string(),
                body: None,
                expected_status: StatusCode::NOT_FOUND,
            },
            compare_body: false,
            expected_error_code: Some("notFound"),
        },
    )
    .await;
}
