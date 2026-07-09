use std::{net::SocketAddr, path::PathBuf, sync::Arc};

use axum::{Json, Router, routing::get};

mod api;
use serde::Serialize;
use thiserror::Error;
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer};
use zai_app::{ServiceContext, initialize_context};
use zai_core::Result as CoreResult;

const DEFAULT_BIND_HOST: &str = "127.0.0.1";
const DEFAULT_BIND_PORT: u16 = 3000;

#[derive(Debug, Error)]
pub enum BindError {
    #[error("non-loopback bind address {0} is not allowed until authentication is implemented")]
    NonLoopback(SocketAddr),
}

#[derive(Debug, Error)]
pub enum ServerError {
    #[error(transparent)]
    Bind(#[from] BindError),

    #[error(transparent)]
    Core(#[from] zai_core::Error),

    #[error("failed to bind listener: {0}")]
    BindListener(std::io::Error),

    #[error("server failed: {0}")]
    Serve(std::io::Error),
}

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub data_dir: PathBuf,
    pub bind_addr: SocketAddr,
}

impl ServerConfig {
    pub fn from_env() -> CoreResult<Self> {
        let data_dir = std::env::var("ZAI_DATA_DIR")
            .map(PathBuf::from)
            .map_err(|_| {
                zai_core::Error::InvalidData(
                    "ZAI_DATA_DIR must be set to a local data directory".to_string(),
                )
            })?;

        let bind_addr = std::env::var("ZAI_BIND_ADDR")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or_else(default_bind_addr);

        Ok(Self {
            data_dir,
            bind_addr,
        })
    }

    pub async fn bind_listener(&self) -> Result<tokio::net::TcpListener, ServerError> {
        validate_bind_addr(&self.bind_addr)?;
        tokio::net::TcpListener::bind(self.bind_addr)
            .await
            .map_err(ServerError::BindListener)
    }
}

pub fn default_bind_addr() -> SocketAddr {
    format!("{DEFAULT_BIND_HOST}:{DEFAULT_BIND_PORT}")
        .parse()
        .expect("default bind address should parse")
}

pub fn validate_bind_addr(addr: &SocketAddr) -> Result<(), BindError> {
    if addr.ip().is_loopback() {
        Ok(())
    } else {
        Err(BindError::NonLoopback(*addr))
    }
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

pub fn default_cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:5173"
                .parse()
                .expect("localhost origin should parse"),
            "http://127.0.0.1:5173"
                .parse()
                .expect("loopback origin should parse"),
        ]))
        .allow_methods(AllowMethods::list([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ]))
        .allow_headers(AllowHeaders::list([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::ACCEPT,
        ]))
}

pub fn create_router(context: Arc<ServiceContext>) -> Router {
    Router::new()
        .route("/health", get(health))
        .nest("/api/cash-flow", api::cash_flow::router())
        .layer(default_cors_layer())
        .with_state(context)
}

pub async fn serve(config: ServerConfig) -> Result<(), ServerError> {
    validate_bind_addr(&config.bind_addr)?;
    let context = Arc::new(initialize_context(&config.data_dir)?);
    let app = create_router(context);
    let listener = config.bind_listener().await?;
    axum::serve(listener, app).await.map_err(ServerError::Serve)
}
