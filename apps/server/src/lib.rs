use std::{ffi::OsString, net::SocketAddr, path::PathBuf, sync::Arc};

use axum::{Json, Router, middleware, routing::get};

use serde::Serialize;
use thiserror::Error;
use tower_http::cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer};

mod mutation_auth;
use zai_app::{ServiceContext, bootstrap_context};
use zai_core::Result as CoreResult;

mod api;

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
    pub zai_home: PathBuf,
    pub bind_addr: SocketAddr,
}

impl ServerConfig {
    pub fn from_env() -> CoreResult<Self> {
        let zai_home = parse_zai_home(
            std::env::var_os("ZAI_HOME"),
            std::env::var_os("ZAI_DATA_DIR").is_some(),
        )?;

        let bind_addr = std::env::var("ZAI_BIND_ADDR")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or_else(default_bind_addr);

        Ok(Self {
            zai_home,
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

fn parse_zai_home(value: Option<OsString>, legacy_data_dir_is_set: bool) -> CoreResult<PathBuf> {
    let Some(value) = value else {
        let message = if legacy_data_dir_is_set {
            "ZAI_DATA_DIR is no longer supported; set ZAI_HOME to an absolute root containing userdata/zai.db"
        } else {
            "ZAI_HOME must be set to an absolute path"
        };
        return Err(zai_core::Error::InvalidData(message.to_string()));
    };

    let path = PathBuf::from(value);
    if !path.is_absolute() {
        return Err(zai_core::Error::InvalidData(
            "ZAI_HOME must be an absolute path".to_string(),
        ));
    }
    Ok(path)
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
        .allow_origin(AllowOrigin::list(mutation_auth::allowed_frontend_origins()))
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
            axum::http::HeaderName::from_static(mutation_auth::ZAI_APP_HEADER),
        ]))
}

pub fn create_router(context: Arc<ServiceContext>) -> Router {
    Router::new()
        .route("/health", get(health))
        .nest("/api", api::router())
        .layer(middleware::from_fn(
            mutation_auth::require_mutation_authenticity,
        ))
        .layer(default_cors_layer())
        .with_state(context)
}

pub async fn serve(config: ServerConfig) -> Result<(), ServerError> {
    let listener = config.bind_listener().await?;
    let bootstrapped = bootstrap_context(&config.zai_home)?;
    let context = Arc::new(bootstrapped.context);
    let supervisor_handle = context.recurring_processing_supervisor();
    let currency_refresh_handle = context.currency_refresh_supervisor();
    let _supervisor = bootstrapped.supervisor.spawn();
    std::mem::drop(bootstrapped.currency_refresh.spawn());
    context.adopt_leftover_currency_jobs();
    let app = create_router(context);
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            let _ = tokio::signal::ctrl_c().await;
            supervisor_handle.request_shutdown();
            currency_refresh_handle.request_shutdown();
        })
        .await
        .map_err(ServerError::Serve)
}

#[cfg(test)]
mod tests {
    use super::parse_zai_home;

    #[test]
    fn parse_zai_home_requires_value() {
        let error = parse_zai_home(None, false).expect_err("missing ZAI_HOME should fail");

        assert!(error.to_string().contains("ZAI_HOME must be set"));
    }

    #[test]
    fn parse_zai_home_rejects_relative_path() {
        let error = parse_zai_home(Some("relative".into()), false)
            .expect_err("relative ZAI_HOME should fail");

        assert!(error.to_string().contains("must be an absolute path"));
    }

    #[test]
    fn parse_zai_home_explains_legacy_variable() {
        let error = parse_zai_home(None, true).expect_err("legacy variable should fail");

        assert!(
            error
                .to_string()
                .contains("ZAI_DATA_DIR is no longer supported")
        );
    }
}
