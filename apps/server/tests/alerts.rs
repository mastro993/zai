mod common;

use axum::http::StatusCode;
use common::{request_json, setup_app};
use zai_core::features::domain_alerts::{
    AlertInsertOutcome, DomainAlertSeverity, NewDomainAlert,
};
use zai_db::connect;

fn sample_alert(occurrence_key: &str, title: &str, severity: DomainAlertSeverity) -> NewDomainAlert {
    NewDomainAlert {
        id: None,
        producer_key: "budget.status".to_string(),
        occurrence_key: occurrence_key.to_string(),
        severity,
        title: title.to_string(),
        body: "Body text".to_string(),
        destination: None,
        data: None,
    }
}

async fn seed_unread_alerts(app_data_dir: &std::path::Path) {
    let database = connect(app_data_dir).expect("database should connect");
    let repository = database.domain_alerts_repository();
    for (occurrence_key, title, severity) in [
        ("a", "Info alert", DomainAlertSeverity::Info),
        ("b", "Warning alert", DomainAlertSeverity::Warning),
        ("c", "Critical alert", DomainAlertSeverity::Critical),
    ] {
        let outcome = repository
            .insert(sample_alert(occurrence_key, title, severity))
            .await
            .expect("insert");
        assert!(matches!(outcome, AlertInsertOutcome::Created(_)));
    }
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
async fn alerts_list_applies_severity_filter() {
    let (router, _context, dir) = setup_app("zai-alerts-api-filters").await;
    seed_unread_alerts(dir.path()).await;

    let (status, body) = request_json(&router, "GET", "/api/alerts?severities=warning", None).await;
    assert_eq!(status, StatusCode::OK);
    let items = body["items"].as_array().expect("items array");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["title"].as_str(), Some("Warning alert"));
}

#[tokio::test]
async fn alerts_list_applies_read_state_filter() {
    let (router, _context, dir) = setup_app("zai-alerts-api-read-state").await;
    seed_unread_alerts(dir.path()).await;

    let (status, body) = request_json(&router, "GET", "/api/alerts?readState=unread", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["items"].as_array().map(Vec::len), Some(3));
}

#[tokio::test]
async fn alerts_list_returns_cursor_for_next_page() {
    let (router, _context, dir) = setup_app("zai-alerts-api-cursor").await;
    seed_unread_alerts(dir.path()).await;

    let (status, body) = request_json(&router, "GET", "/api/alerts?limit=2", None).await;
    assert_eq!(status, StatusCode::OK);
    let items = body["items"].as_array().expect("items array");
    assert_eq!(items.len(), 2);
    let cursor = body["nextCursor"].as_str().expect("next cursor");
    assert!(!cursor.is_empty());

    let (status, body) = request_json(
        &router,
        "GET",
        &format!("/api/alerts?limit=2&cursor={cursor}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let items = body["items"].as_array().expect("items array");
    assert_eq!(items.len(), 1);
    assert!(body["nextCursor"].is_null());
}

#[tokio::test]
async fn alerts_list_rejects_malformed_cursor() {
    let (router, _context, _dir) = setup_app("zai-alerts-api-cursor-validation").await;
    let (status, body) =
        request_json(&router, "GET", "/api/alerts?cursor=not-a-cursor", None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"].as_str(), Some("validation"));
}

#[tokio::test]
async fn alerts_list_rejects_empty_severity_filter() {
    let (router, _context, _dir) = setup_app("zai-alerts-api-empty-severities").await;
    let (status, _body) = request_json(&router, "GET", "/api/alerts?severities=", None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}
