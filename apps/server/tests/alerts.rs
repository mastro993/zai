mod common;

use axum::http::StatusCode;
use common::{request_json, setup_app};

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
