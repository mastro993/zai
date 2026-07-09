use std::{
    env, fs,
    net::{IpAddr, Ipv4Addr, SocketAddr},
    path::{Path, PathBuf},
    sync::Arc,
};

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt;
use uuid::Uuid;
use zai_app::initialize_context;
use zai_server::{
    BindError, ServerConfig, ServerError, create_router, default_bind_addr, serve,
    validate_bind_addr,
};

struct TempAppDataDir {
    path: PathBuf,
}

impl TempAppDataDir {
    fn new() -> Self {
        Self {
            path: env::temp_dir().join(format!("zai-server-test-{}", Uuid::new_v4())),
        }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempAppDataDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

#[test]
fn default_bind_addr_is_loopback() {
    let addr = default_bind_addr();
    assert!(addr.ip().is_loopback());
}

#[test]
fn validate_bind_addr_accepts_ipv4_loopback() {
    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 3000);
    assert!(validate_bind_addr(&addr).is_ok());
}

#[test]
fn validate_bind_addr_accepts_ipv6_loopback() {
    let addr = SocketAddr::new(IpAddr::V6(std::net::Ipv6Addr::LOCALHOST), 3000);
    assert!(validate_bind_addr(&addr).is_ok());
}

#[test]
fn validate_bind_addr_rejects_non_loopback() {
    let cases = [
        SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), 3000),
        SocketAddr::new(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 1)), 3000),
        SocketAddr::new(IpAddr::V6(std::net::Ipv6Addr::UNSPECIFIED), 3000),
    ];

    for addr in cases {
        let error = validate_bind_addr(&addr).expect_err("non-loopback bind should fail");
        assert!(matches!(error, BindError::NonLoopback(rejected) if rejected == addr));
    }
}

#[tokio::test]
async fn serve_rejects_non_loopback_bind_before_initializing_database() {
    let app_data_dir = TempAppDataDir::new();
    let config = ServerConfig {
        data_dir: app_data_dir.path().to_path_buf(),
        bind_addr: SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), 3000),
    };

    let error = serve(config)
        .await
        .expect_err("serve should reject non-loopback bind");

    assert!(matches!(
        error,
        ServerError::Bind(BindError::NonLoopback(addr)) if addr.ip() == IpAddr::V4(Ipv4Addr::UNSPECIFIED)
    ));
    assert!(!app_data_dir.path().join("zai.db").exists());
}

#[tokio::test]
async fn health_route_returns_ok() {
    let app_data_dir = TempAppDataDir::new();
    let context = Arc::new(
        initialize_context(app_data_dir.path()).expect("shared context should initialize"),
    );
    let app = create_router(context);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("health request should succeed");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn server_starts_with_shared_context_from_app_data_dir() {
    let app_data_dir = TempAppDataDir::new();
    let config = ServerConfig {
        data_dir: app_data_dir.path().to_path_buf(),
        bind_addr: SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0),
    };

    let listener = config
        .bind_listener()
        .await
        .expect("server should bind on loopback");
    let bind_addr = listener
        .local_addr()
        .expect("listener should have local addr");
    assert!(bind_addr.ip().is_loopback());

    let context =
        Arc::new(initialize_context(&config.data_dir).expect("shared context should initialize"));
    assert!(config.data_dir.join("zai.db").exists());

    let app = create_router(context);
    let handle = tokio::spawn(async move {
        axum::serve(listener, app).await.expect("server should run");
    });

    let mut stream = tokio::net::TcpStream::connect(bind_addr)
        .await
        .expect("client should connect to local server");
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    stream
        .write_all(b"GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
        .await
        .expect("client should send health request");

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .await
        .expect("client should read health response");

    assert!(response.contains("200 OK"));
    assert!(response.contains("\"status\":\"ok\""));

    handle.abort();
}

#[tokio::test]
async fn cors_does_not_allow_wildcard_credentialed_access() {
    let app_data_dir = TempAppDataDir::new();
    let context = Arc::new(
        initialize_context(app_data_dir.path()).expect("shared context should initialize"),
    );
    let app = create_router(context);

    let response = app
        .oneshot(
            Request::builder()
                .method("OPTIONS")
                .uri("/health")
                .header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("preflight request should succeed");

    let allow_origin = response
        .headers()
        .get("access-control-allow-origin")
        .and_then(|value| value.to_str().ok());
    let allow_credentials = response
        .headers()
        .get("access-control-allow-credentials")
        .and_then(|value| value.to_str().ok());

    let is_wildcard_credentialed = allow_origin == Some("*") && allow_credentials == Some("true");
    assert!(
        !is_wildcard_credentialed,
        "CORS must not allow wildcard origin with credentials"
    );
}
