use axum::{
    Json,
    body::Body,
    extract::Request,
    http::{HeaderValue, Method, header},
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::api::error::{ApiError, forbidden};

pub const ZAI_APP_HEADER: &str = "x-zai-app";
const ZAI_APP_HEADER_VALUE: &str = "zai";

const ALLOWED_FRONTEND_ORIGINS: &[&str] = &[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
];

pub fn allowed_frontend_origins() -> Vec<HeaderValue> {
    ALLOWED_FRONTEND_ORIGINS
        .iter()
        .map(|origin| {
            origin
                .parse()
                .unwrap_or_else(|_| panic!("allowed frontend origin should parse: {origin}"))
        })
        .collect()
}

fn is_mutation_method(method: &Method) -> bool {
    matches!(
        method,
        &Method::POST | &Method::PUT | &Method::PATCH | &Method::DELETE
    )
}

fn is_allowed_origin(origin: &HeaderValue) -> bool {
    let Ok(origin) = origin.to_str() else {
        return false;
    };

    ALLOWED_FRONTEND_ORIGINS.contains(&origin)
}

fn has_non_simple_mutation_proof(headers: &axum::http::HeaderMap) -> bool {
    if headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| {
            value
                .split(';')
                .next()
                .is_some_and(|mime| mime.eq_ignore_ascii_case("application/json"))
        })
    {
        return true;
    }

    headers
        .get(ZAI_APP_HEADER)
        .and_then(|value| value.to_str().ok())
        == Some(ZAI_APP_HEADER_VALUE)
}

fn reject_mutation(message: &'static str) -> Response {
    let (status, Json(body)): (axum::http::StatusCode, Json<ApiError>) = forbidden(message);
    (status, Json(body)).into_response()
}

pub async fn require_mutation_authenticity(request: Request<Body>, next: Next) -> Response {
    if !is_mutation_method(request.method()) {
        return next.run(request).await;
    }

    if let Some(origin) = request.headers().get(header::ORIGIN)
        && !is_allowed_origin(origin)
    {
        return reject_mutation("Origin not allowed");
    }

    if !has_non_simple_mutation_proof(request.headers()) {
        return reject_mutation(
            "Mutation requests must identify as JSON or Zai application traffic",
        );
    }

    next.run(request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allowed_origins_match_cors_configuration() {
        let origins = allowed_frontend_origins();
        assert_eq!(origins.len(), ALLOWED_FRONTEND_ORIGINS.len());
    }

    #[test]
    fn json_content_type_is_accepted_mutation_proof() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        );
        assert!(has_non_simple_mutation_proof(&headers));
    }

    #[test]
    fn zai_application_header_is_accepted_mutation_proof() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert(
            ZAI_APP_HEADER,
            HeaderValue::from_static(ZAI_APP_HEADER_VALUE),
        );
        assert!(has_non_simple_mutation_proof(&headers));
    }
}
