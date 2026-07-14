mod common;

use axum::http::StatusCode;
use common::{request_json, setup_app};
use zai_core::features::domain_alerts::{AlertInsertOutcome, DomainAlertSeverity, NewDomainAlert};
use zai_db::connect;

async fn insert_sample_alert(app_data_dir: &std::path::Path) -> String {
    let database = connect(app_data_dir).expect("database");
    let repo = database.domain_alerts_repository();
    let outcome = repo
        .insert(NewDomainAlert {
            id: None,
            producer_key: "budget.status".to_string(),
            occurrence_key: "period-1".to_string(),
            severity: DomainAlertSeverity::Warning,
            title: "Budget warning".to_string(),
            body: "Spending exceeded 80% of allowance.".to_string(),
            destination: None,
            data: None,
        })
        .await
        .expect("insert");
    let AlertInsertOutcome::Created(alert) = outcome else {
        panic!("expected created alert");
    };
    alert.id
}

#[tokio::test]
async fn alerts_list_and_unread_count_endpoints_return_empty_canonical_state() {
    let (router, context, _dir) = setup_app("zai-alerts-api").await;
    let page = context
        .domain_alerts_service()
        .list_alerts(Default::default())
        .await
        .expect("service should be wired");
    assert!(page.items.is_empty());

    let (status, body) = request_json(&router, "GET", "/api/alerts", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["items"].as_array().map(Vec::len), Some(0));
    assert!(body["nextCursor"].is_null());

    let (status, body) = request_json(&router, "GET", "/api/alerts/unread-count", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_i64(), Some(0));
}

#[tokio::test]
async fn alerts_list_rejects_invalid_limit() {
    let (router, _context, _dir) = setup_app("zai-alerts-api-validation").await;
    let (status, body) = request_json(&router, "GET", "/api/alerts?limit=0", None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"].as_str(), Some("validation"));
}

#[tokio::test]
async fn mark_alert_read_and_unread_endpoints_persist_lifecycle_state() {
    let (router, _context, dir) = setup_app("zai-alerts-lifecycle").await;
    let alert_id = insert_sample_alert(dir.path()).await;

    let (status, body) = request_json(
        &router,
        "POST",
        &format!("/api/alerts/{alert_id}/read"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["id"].as_str(), Some(alert_id.as_str()));
    assert!(body["readAt"].is_string());

    let (status, body) = request_json(
        &router,
        "POST",
        &format!("/api/alerts/{alert_id}/read"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let first_read_at = body["readAt"].as_str().expect("readAt");

    let (status, body) = request_json(
        &router,
        "POST",
        &format!("/api/alerts/{alert_id}/unread"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["readAt"].is_null());

    let (status, body) = request_json(
        &router,
        "POST",
        &format!("/api/alerts/{alert_id}/read"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_ne!(body["readAt"].as_str(), Some(first_read_at));
}

#[tokio::test]
async fn mark_alert_read_returns_not_found_for_unknown_id() {
    let (router, _context, _dir) = setup_app("zai-alerts-not-found").await;
    let unknown_id = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";
    let (status, body) = request_json(
        &router,
        "POST",
        &format!("/api/alerts/{unknown_id}/read"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"].as_str(), Some("notFound"));
}
