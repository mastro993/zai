use axum::{
    Json,
    http::StatusCode,
};
use serde::Serialize;
use zai_core::{DatabaseError, Error};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    pub message: String,
}

impl ApiError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

pub fn command_error(context: &str, error: Error) -> (StatusCode, Json<ApiError>) {
    let message = format!("{context}: {error}");
    (status_for_error(&error), Json(ApiError::new(message)))
}

pub fn bad_request(message: impl Into<String>) -> (StatusCode, Json<ApiError>) {
    (
        StatusCode::BAD_REQUEST,
        Json(ApiError::new(message.into())),
    )
}

fn status_for_error(error: &Error) -> StatusCode {
    match error {
        Error::InvalidData(_) => StatusCode::BAD_REQUEST,
        Error::NotFound(_) => StatusCode::NOT_FOUND,
        Error::Database(db_error) => match db_error {
            DatabaseError::NotFound(_) => StatusCode::NOT_FOUND,
            DatabaseError::UniqueViolation(_) | DatabaseError::ForeignKeyViolation(_) => {
                StatusCode::CONFLICT
            }
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        },
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
