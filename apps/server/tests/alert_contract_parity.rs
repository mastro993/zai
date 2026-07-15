mod common;
mod contract_harness;

use axum::http::StatusCode;

use contract_harness::{
    ContractExpectation, HttpCall, assert_read_parity, compare_http_and_tauri, seed_alert,
    setup_contract,
};

#[tokio::test]
async fn alert_contract_list_and_unread_count_match_across_transports() {
    let harness = setup_contract("zai-alert-contract-list").await;
    seed_alert(harness._dir.path(), "period-1", "Budget warning").await;

    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "GET",
                path: "/api/alerts".to_string(),
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
                path: "/api/alerts/unread-count".to_string(),
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
async fn alert_contract_validation_matches_across_transports() {
    let harness = setup_contract("zai-alert-contract-validation").await;
    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "GET",
                path: "/api/alerts?limit=0".to_string(),
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
async fn alert_contract_mark_read_matches_across_transports() {
    let harness = setup_contract("zai-alert-contract-read").await;
    let alert_id = seed_alert(harness._dir.path(), "read", "Read alert").await;

    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "POST",
                path: format!("/api/alerts/{alert_id}/read"),
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
async fn alert_contract_mark_unread_matches_across_transports() {
    let harness = setup_contract("zai-alert-contract-unread").await;
    let alert_id = seed_alert(harness._dir.path(), "unread", "Unread alert").await;

    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "POST",
                path: format!("/api/alerts/{alert_id}/read"),
                body: None,
                expected_status: StatusCode::OK,
            },
            compare_body: false,
            expected_error_code: None,
        },
    )
    .await;

    assert_read_parity(
        &harness,
        ContractExpectation {
            http: HttpCall {
                method: "POST",
                path: format!("/api/alerts/{alert_id}/unread"),
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
async fn alert_contract_mark_all_read_matches_across_transports() {
    let http = setup_contract("zai-alert-contract-mark-all-http").await;
    let tauri = setup_contract("zai-alert-contract-mark-all-tauri").await;
    seed_alert(http._dir.path(), "mark-all", "Mark all alert").await;
    seed_alert(tauri._dir.path(), "mark-all", "Mark all alert").await;

    compare_http_and_tauri(
        &http,
        &tauri,
        |_| ContractExpectation {
            http: HttpCall {
                method: "POST",
                path: "/api/alerts/mark-all-read".to_string(),
                body: None,
                expected_status: StatusCode::OK,
            },
            compare_body: true,
            expected_error_code: None,
        },
        "",
        "",
    )
    .await;
}
