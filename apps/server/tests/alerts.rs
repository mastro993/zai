mod common;

use axum::http::StatusCode;
use common::{request_json, request_json_with_headers, setup_app};
use zai_core::features::domain_alerts::{AlertInsertOutcome, DomainAlertSeverity, NewDomainAlert};
use zai_db::connect;

fn sample_alert(
    occurrence_key: &str,
    title: &str,
    severity: DomainAlertSeverity,
) -> NewDomainAlert {
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

async fn insert_sample_alert(app_data_dir: &std::path::Path) -> String {
    let database = connect(app_data_dir).expect("database");
    let repo = database.domain_alerts_repository();
    let outcome = repo
        .insert(sample_alert(
            "period-1",
            "Budget warning",
            DomainAlertSeverity::Warning,
        ))
        .await
        .expect("insert");
    let AlertInsertOutcome::Created(alert) = outcome else {
        panic!("expected created alert");
    };
    alert.id
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
async fn alerts_list_accepts_repeated_severity_filters() {
    let (router, _context, dir) = setup_app("zai-alerts-api-multiple-severities").await;
    seed_unread_alerts(dir.path()).await;

    let (status, body) = request_json(
        &router,
        "GET",
        "/api/alerts?severities=warning&severities=critical",
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let items = body["items"].as_array().expect("items array");
    assert_eq!(items.len(), 2);
    assert!(items.iter().any(|item| item["severity"] == "warning"));
    assert!(items.iter().any(|item| item["severity"] == "critical"));
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

#[tokio::test]
async fn mark_all_alerts_read_returns_affected_count_and_is_idempotent() {
    let (router, _context, dir) = setup_app("zai-alerts-mark-all-read").await;
    seed_unread_alerts(dir.path()).await;

    let (status, body) = request_json(&router, "POST", "/api/alerts/mark-all-read", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_i64(), Some(3));

    let (status, body) = request_json(&router, "POST", "/api/alerts/mark-all-read", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_i64(), Some(0));

    let (status, body) = request_json(&router, "GET", "/api/alerts/unread-count", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_i64(), Some(0));
}

#[tokio::test]
async fn alert_mutations_reject_disallowed_origin_and_leave_state_unchanged() {
    let (router, _context, dir) = setup_app("zai-alerts-hostile-origin").await;
    seed_unread_alerts(dir.path()).await;
    let alert_id = insert_sample_alert(dir.path()).await;

    let routes = [
        ("POST", "/api/alerts/mark-all-read".to_string()),
        ("POST", format!("/api/alerts/{alert_id}/read")),
        ("POST", format!("/api/alerts/{alert_id}/unread")),
    ];

    for (method, uri) in routes {
        let (status, body) =
            request_json_with_headers(&router, method, &uri, None, Some("https://evil.example"))
                .await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{method} {uri}");
        assert_eq!(body["code"].as_str(), Some("forbidden"));
    }

    let (status, body) = request_json(&router, "GET", "/api/alerts/unread-count", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_i64(), Some(4));
}

#[tokio::test]
async fn alert_mutations_accept_allowed_frontend_origin() {
    let (router, _context, dir) = setup_app("zai-alerts-allowed-origin").await;
    let alert_id = insert_sample_alert(dir.path()).await;

    let (status, body) = request_json_with_headers(
        &router,
        "POST",
        &format!("/api/alerts/{alert_id}/read"),
        None,
        Some("http://localhost:5173"),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["readAt"].is_string());
}

#[tokio::test]
async fn alert_mutations_accept_missing_origin_for_non_browser_clients() {
    let (router, _context, dir) = setup_app("zai-alerts-no-origin").await;
    let alert_id = insert_sample_alert(dir.path()).await;

    let (status, body) = request_json(
        &router,
        "POST",
        &format!("/api/alerts/{alert_id}/read"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["readAt"].is_string());
}

#[tokio::test]
async fn alert_mutations_reject_bodyless_simple_posts_without_json_proof() {
    use tower::ServiceExt;

    let (router, _context, dir) = setup_app("zai-alerts-simple-post").await;
    let alert_id = insert_sample_alert(dir.path()).await;

    let request = axum::http::Request::builder()
        .method("POST")
        .uri(format!("/api/alerts/{alert_id}/read"))
        .header("Origin", "http://localhost:5173")
        .body(axum::body::Body::empty())
        .expect("request should build");

    let response = router
        .clone()
        .oneshot(request)
        .await
        .expect("request should succeed");
    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    let (status, body) = request_json(&router, "GET", "/api/alerts/unread-count", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_i64(), Some(1));
}
