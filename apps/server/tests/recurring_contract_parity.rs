mod common;
mod contract_harness;
mod recurring_contract;

use axum::http::StatusCode;

use common::request_json;
use contract_harness::seed_transaction;
use recurring_contract::{
    CONTRACT_RECURRING_ID, adopt_success, adoption_preview_success, assert_read_parity,
    attribution_projection_success, bulk_execute_success, bulk_preflight_success,
    compare_http_and_tauri, create_success, create_validation_error, delete_success,
    detail_success, failure_history_success, feed_cursor_validation_error, feed_success,
    not_found_detail, pause_success, processing_status_success, projection_success,
    provenance_success, repair_preview_without_failure_error, resume_success,
    retry_without_failure_unchanged, seed_recurring, setup_contract, stop_success, update_success,
};

#[tokio::test]
async fn recurring_contract_create_feed_detail_and_paging_match() {
    let http = setup_contract("recurring-create-http").await;
    let tauri = setup_contract("recurring-create-tauri").await;
    compare_http_and_tauri(
        &http,
        &tauri,
        |_| create_success(CONTRACT_RECURRING_ID),
        "",
        "",
    )
    .await;

    let harness = setup_contract("recurring-feed-detail").await;
    let (status, _) = seed_recurring(&harness, CONTRACT_RECURRING_ID).await;
    assert_eq!(status, StatusCode::CREATED);

    assert_read_parity(&harness, feed_success()).await;
    assert_read_parity(&harness, detail_success(CONTRACT_RECURRING_ID)).await;
    assert_read_parity(&harness, feed_cursor_validation_error()).await;
    assert_read_parity(&harness, failure_history_success(CONTRACT_RECURRING_ID)).await;
    assert_read_parity(
        &harness,
        attribution_projection_success(CONTRACT_RECURRING_ID),
    )
    .await;
}

#[tokio::test]
async fn recurring_contract_lifecycle_edit_bulk_status_and_recovery_errors_match() {
    let http = setup_contract("recurring-pause-http").await;
    let tauri = setup_contract("recurring-pause-tauri").await;
    let (status, _) = seed_recurring(&http, CONTRACT_RECURRING_ID).await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, _) = seed_recurring(&tauri, CONTRACT_RECURRING_ID).await;
    assert_eq!(status, StatusCode::CREATED);
    compare_http_and_tauri(
        &http,
        &tauri,
        |id| pause_success(id, 1),
        CONTRACT_RECURRING_ID,
        CONTRACT_RECURRING_ID,
    )
    .await;

    let http = setup_contract("recurring-resume-http").await;
    let tauri = setup_contract("recurring-resume-tauri").await;
    let (status, _) = seed_recurring(&http, CONTRACT_RECURRING_ID).await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, _) = seed_recurring(&tauri, CONTRACT_RECURRING_ID).await;
    assert_eq!(status, StatusCode::CREATED);
    let pause = pause_success(CONTRACT_RECURRING_ID, 1);
    let (status, _) = request_json(
        &http.router,
        pause.http.method,
        &pause.http.path,
        pause.http.body.clone(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = request_json(
        &tauri.router,
        pause.http.method,
        &pause.http.path,
        pause.http.body.clone(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    compare_http_and_tauri(
        &http,
        &tauri,
        |id| resume_success(id, 2),
        CONTRACT_RECURRING_ID,
        CONTRACT_RECURRING_ID,
    )
    .await;

    let http = setup_contract("recurring-edit-http").await;
    let tauri = setup_contract("recurring-edit-tauri").await;
    let (status, _) = seed_recurring(&http, CONTRACT_RECURRING_ID).await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, _) = seed_recurring(&tauri, CONTRACT_RECURRING_ID).await;
    assert_eq!(status, StatusCode::CREATED);
    compare_http_and_tauri(
        &http,
        &tauri,
        |id| update_success(id, 1),
        CONTRACT_RECURRING_ID,
        CONTRACT_RECURRING_ID,
    )
    .await;

    let http = setup_contract("recurring-bulk-exec-http").await;
    let tauri = setup_contract("recurring-bulk-exec-tauri").await;
    let (status, _) = seed_recurring(&http, CONTRACT_RECURRING_ID).await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, _) = seed_recurring(&tauri, CONTRACT_RECURRING_ID).await;
    assert_eq!(status, StatusCode::CREATED);
    compare_http_and_tauri(
        &http,
        &tauri,
        |id| bulk_execute_success(id, 1),
        CONTRACT_RECURRING_ID,
        CONTRACT_RECURRING_ID,
    )
    .await;

    let harness = setup_contract("recurring-provenance").await;
    let (status, _) = seed_recurring(&harness, CONTRACT_RECURRING_ID).await;
    assert_eq!(status, StatusCode::CREATED);
    assert_read_parity(&harness, provenance_success("missing-txn")).await;
    assert_read_parity(&harness, projection_success()).await;
    assert_read_parity(&harness, bulk_preflight_success(CONTRACT_RECURRING_ID, 1)).await;
    assert_read_parity(&harness, processing_status_success()).await;
    assert_read_parity(
        &harness,
        retry_without_failure_unchanged(CONTRACT_RECURRING_ID, 1),
    )
    .await;
    assert_read_parity(
        &harness,
        repair_preview_without_failure_error(CONTRACT_RECURRING_ID),
    )
    .await;

    let http = setup_contract("recurring-stop-http").await;
    let tauri = setup_contract("recurring-stop-tauri").await;
    let (status, _) = seed_recurring(&http, "rt-stop").await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, _) = seed_recurring(&tauri, "rt-stop").await;
    assert_eq!(status, StatusCode::CREATED);
    compare_http_and_tauri(
        &http,
        &tauri,
        |id| stop_success(id, 1),
        "rt-stop",
        "rt-stop",
    )
    .await;

    let http = setup_contract("recurring-delete-http").await;
    let tauri = setup_contract("recurring-delete-tauri").await;
    let (status, _) = seed_recurring(&http, "rt-delete").await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, _) = seed_recurring(&tauri, "rt-delete").await;
    assert_eq!(status, StatusCode::CREATED);
    compare_http_and_tauri(
        &http,
        &tauri,
        |id| delete_success(id, 1),
        "rt-delete",
        "rt-delete",
    )
    .await;
}

#[tokio::test]
async fn recurring_contract_adoption_and_public_errors_match() {
    let http = setup_contract("recurring-adopt-http").await;
    let tauri = setup_contract("recurring-adopt-tauri").await;
    let (status, http_txn) = seed_transaction(&http, "Adopt seed").await;
    assert_eq!(status, StatusCode::CREATED);
    let (status, tauri_txn) = seed_transaction(&tauri, "Adopt seed").await;
    assert_eq!(status, StatusCode::CREATED);
    let http_txn_id = http_txn["id"].as_str().expect("http txn id").to_string();
    let tauri_txn_id = tauri_txn["id"].as_str().expect("tauri txn id").to_string();

    assert_read_parity(&http, adoption_preview_success(&http_txn_id)).await;
    assert_read_parity(&tauri, adoption_preview_success(&tauri_txn_id)).await;

    compare_http_and_tauri(
        &http,
        &tauri,
        |txn_id| adopt_success("rt-adopt-a", txn_id),
        &http_txn_id,
        &tauri_txn_id,
    )
    .await;

    let http = setup_contract("recurring-validation-http").await;
    let tauri = setup_contract("recurring-validation-tauri").await;
    compare_http_and_tauri(&http, &tauri, |_| create_validation_error(), "", "").await;

    let harness = setup_contract("recurring-not-found").await;
    assert_read_parity(&harness, not_found_detail("rt-missing")).await;
}
