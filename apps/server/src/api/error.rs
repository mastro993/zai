use axum::{Json, http::StatusCode};
use zai_core::{DatabaseError, Error, ErrorCode, ErrorEnvelope};

pub type ApiError = ErrorEnvelope;

pub fn command_error(context: &str, error: Error) -> (StatusCode, Json<ApiError>) {
    let status = status_for_error(&error);
    (status, Json(error.to_envelope(context)))
}

pub fn bad_request(message: impl Into<String>) -> (StatusCode, Json<ApiError>) {
    (
        StatusCode::BAD_REQUEST,
        Json(ErrorEnvelope::new(ErrorCode::Validation, message)),
    )
}

fn status_for_error(error: &Error) -> StatusCode {
    match error {
        Error::InvalidData(_) => StatusCode::BAD_REQUEST,
        Error::NotFound(_) => StatusCode::NOT_FOUND,
        Error::Conflict(_) | Error::NameConflict(_) => StatusCode::CONFLICT,
        Error::PeriodAdvanceLimitExceeded(_) | Error::ClockRegression(_) => StatusCode::CONFLICT,
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn command_errors_use_the_shared_envelope() {
        let (status, Json(body)) = command_error(
            "Failed to load transaction",
            Error::NotFound("txn-404".to_string()),
        );

        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(
            serde_json::to_value(body).expect("error envelope should serialize"),
            json!({
                "code": "notFound",
                "message": "Failed to load transaction: Not found: txn-404"
            })
        );
    }

    #[test]
    fn conflict_errors_map_to_http_conflict() {
        let (status, Json(body)) = command_error(
            "Failed to create transaction category",
            Error::Database(DatabaseError::UniqueViolation(
                "A category already exists".to_string(),
            )),
        );

        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(
            serde_json::to_value(body).expect("error envelope should serialize")["code"],
            "conflict"
        );
    }
}
