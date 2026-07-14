mod budget_contract;
mod common;

use axum::http::StatusCode;

use budget_contract::{
    assert_read_parity, cadence_validation_error, compare_http_and_tauri, create_success,
    delete_no_content, detail_success, history_success, history_validation_error,
    list_active_success, name_conflict_error, not_found_detail, pause_success, request_delete,
    request_pause, request_resume, request_update, resume_success, revision_conflict_update,
    seed_budget, setup_contract, update_success,
};

async fn seed_monthly(harness: &budget_contract::ContractHarness) -> String {
    let (status, created) = seed_budget(harness, "Monthly").await;
    assert_eq!(status, StatusCode::CREATED);
    created["id"].as_str().expect("budget id").to_string()
}

#[tokio::test]
async fn budget_contract_create_list_detail_and_history_match_across_transports() {
    let http = setup_contract("contract-create-http").await;
    let tauri = setup_contract("contract-create-tauri").await;
    compare_http_and_tauri(
        &http,
        &tauri,
        |_| create_success("Monthly spending"),
        "",
        "",
    )
    .await;

    let harness = setup_contract("zai-budget-contract-lifecycle").await;
    let (_, created) = seed_budget(&harness, "Monthly spending").await;
    let budget_id = created["id"].as_str().expect("budget id");

    assert_read_parity(&harness, list_active_success()).await;
    assert_read_parity(&harness, detail_success(budget_id)).await;
    assert_read_parity(&harness, history_success(budget_id)).await;
}

#[tokio::test]
async fn budget_contract_error_operations_match_across_transports() {
    let http = setup_contract("contract-name-conflict-http").await;
    let tauri = setup_contract("contract-name-conflict-tauri").await;
    let http_id = seed_monthly(&http).await;
    let tauri_id = seed_monthly(&tauri).await;
    compare_http_and_tauri(
        &http,
        &tauri,
        |_| name_conflict_error(),
        &http_id,
        &tauri_id,
    )
    .await;

    let http = setup_contract("contract-cadence-http").await;
    let tauri = setup_contract("contract-cadence-tauri").await;
    let http_id = seed_monthly(&http).await;
    let tauri_id = seed_monthly(&tauri).await;
    compare_http_and_tauri(&http, &tauri, cadence_validation_error, &http_id, &tauri_id).await;

    let http = setup_contract("contract-revision-http").await;
    let tauri = setup_contract("contract-revision-tauri").await;
    let http_id = seed_monthly(&http).await;
    let tauri_id = seed_monthly(&tauri).await;
    let (status, _) = request_update(&http, &http_id, 0).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = request_update(&tauri, &tauri_id, 0).await;
    assert_eq!(status, StatusCode::OK);
    compare_http_and_tauri(&http, &tauri, revision_conflict_update, &http_id, &tauri_id).await;

    let harness = setup_contract("zai-budget-contract-history-validation").await;
    let (_, created) = seed_budget(&harness, "History").await;
    let budget_id = created["id"].as_str().expect("budget id");
    assert_read_parity(&harness, history_validation_error(budget_id)).await;
}

#[tokio::test]
async fn budget_contract_lifecycle_and_delete_match_across_transports() {
    let http = setup_contract("contract-pause-http").await;
    let tauri = setup_contract("contract-pause-tauri").await;
    let http_id = seed_monthly(&http).await;
    let tauri_id = seed_monthly(&tauri).await;
    compare_http_and_tauri(
        &http,
        &tauri,
        |budget_id| pause_success(budget_id, 0),
        &http_id,
        &tauri_id,
    )
    .await;

    let http = setup_contract("contract-resume-http").await;
    let tauri = setup_contract("contract-resume-tauri").await;
    let http_id = seed_monthly(&http).await;
    let tauri_id = seed_monthly(&tauri).await;
    let (status, _) = request_pause(&http, &http_id, 0).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = request_pause(&tauri, &tauri_id, 0).await;
    assert_eq!(status, StatusCode::OK);
    compare_http_and_tauri(
        &http,
        &tauri,
        |budget_id| resume_success(budget_id, 1),
        &http_id,
        &tauri_id,
    )
    .await;

    let http = setup_contract("contract-update-http").await;
    let tauri = setup_contract("contract-update-tauri").await;
    let http_id = seed_monthly(&http).await;
    let tauri_id = seed_monthly(&tauri).await;
    compare_http_and_tauri(
        &http,
        &tauri,
        |budget_id| update_success(budget_id, 0),
        &http_id,
        &tauri_id,
    )
    .await;

    let http = setup_contract("contract-delete-http").await;
    let tauri = setup_contract("contract-delete-tauri").await;
    let http_id = seed_monthly(&http).await;
    let tauri_id = seed_monthly(&tauri).await;
    let (status, _) = request_pause(&http, &http_id, 0).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = request_resume(&http, &http_id, 1).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = request_pause(&tauri, &tauri_id, 0).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = request_resume(&tauri, &tauri_id, 1).await;
    assert_eq!(status, StatusCode::OK);
    compare_http_and_tauri(
        &http,
        &tauri,
        |budget_id| delete_no_content(budget_id, 2),
        &http_id,
        &tauri_id,
    )
    .await;

    let harness = setup_contract("zai-budget-contract-delete-read").await;
    let budget_id = seed_monthly(&harness).await;
    let (status, _) = request_delete(&harness, &budget_id, 0).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_read_parity(&harness, not_found_detail(&budget_id)).await;
    assert_read_parity(&harness, list_active_success()).await;
}
