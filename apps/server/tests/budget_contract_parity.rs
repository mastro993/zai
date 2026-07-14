mod budget_contract;
mod common;

use axum::http::StatusCode;

use budget_contract::{
    assert_transport_parity, cadence_validation_error, create_success, delete_no_content,
    detail_success, history_success, history_validation_error, list_active_success,
    name_conflict_error, not_found_detail, pause_success, paused_list_success, resume_success,
    revision_conflict_update, seed_budget, setup_contract, update_success,
};

#[tokio::test]
async fn budget_contract_create_list_detail_and_history_match_across_transports() {
    let harness = setup_contract("zai-budget-contract-lifecycle").await;
    let (status, _) = seed_budget(&harness, "Monthly spending", Some("contract-budget-1")).await;
    assert_eq!(status, StatusCode::CREATED);

    assert_transport_parity(&harness, create_success("contract-budget-2")).await;
    assert_transport_parity(&harness, list_active_success()).await;
    assert_transport_parity(&harness, detail_success("contract-budget-1")).await;
    assert_transport_parity(&harness, history_success("contract-budget-1")).await;
}

#[tokio::test]
async fn budget_contract_error_operations_match_across_transports() {
    let harness = setup_contract("zai-budget-contract-errors").await;
    let (status, _) = seed_budget(&harness, "Monthly", Some("contract-error-budget")).await;
    assert_eq!(status, StatusCode::CREATED);

    assert_transport_parity(&harness, name_conflict_error()).await;
    assert_transport_parity(&harness, cadence_validation_error("contract-error-budget")).await;
    assert_transport_parity(&harness, history_validation_error("contract-error-budget")).await;
    assert_transport_parity(&harness, update_success("contract-error-budget", 0)).await;
    assert_transport_parity(&harness, revision_conflict_update("contract-error-budget")).await;
}

#[tokio::test]
async fn budget_contract_lifecycle_and_delete_match_across_transports() {
    let harness = setup_contract("zai-budget-contract-delete").await;
    let (status, _) = seed_budget(&harness, "Lifecycle", Some("contract-delete-budget")).await;
    assert_eq!(status, StatusCode::CREATED);

    assert_transport_parity(&harness, pause_success("contract-delete-budget", 0)).await;
    assert_transport_parity(&harness, paused_list_success()).await;
    assert_transport_parity(&harness, resume_success("contract-delete-budget", 1)).await;
    assert_transport_parity(&harness, delete_no_content("contract-delete-budget", 2)).await;
    assert_transport_parity(&harness, not_found_detail("contract-delete-budget")).await;
}
