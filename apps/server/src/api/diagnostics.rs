use std::sync::Arc;

use axum::{Json, Router, extract::State, routing::get};
use zai_app::{DiagnosticsReport, ServiceContext};

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new().route("/diagnostics", get(get_diagnostics))
}

async fn get_diagnostics(State(context): State<Arc<ServiceContext>>) -> Json<DiagnosticsReport> {
    Json(context.diagnostics(None))
}
