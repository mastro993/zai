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

pub fn forbidden(message: impl Into<String>) -> (StatusCode, Json<ApiError>) {
    (
        StatusCode::FORBIDDEN,
        Json(ErrorEnvelope::new(ErrorCode::Forbidden, message)),
    )
}

fn status_for_error(error: &Error) -> StatusCode {
    match error {
        Error::InvalidData(_) => StatusCode::BAD_REQUEST,
        Error::NotFound(_) => StatusCode::NOT_FOUND,
        Error::Conflict(_)
        | Error::NameConflict(_)
        | Error::RevisionConflict { .. }
        | Error::BudgetImpactConfirmationRequired { .. }
        | Error::CategoryDeletionBlocked { .. } => StatusCode::CONFLICT,
        Error::PeriodAdvanceLimitExceeded(_)
        | Error::ClockRegression(_)
        | Error::CalculationOverflow(_) => StatusCode::CONFLICT,
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
    fn internal_errors_redact_implementation_details() {
        const SENTINEL_SQL: &str = "SENTINEL_SQL_SELECT * FROM secrets";
        const SENTINEL_PATH: &str = "/home/user/.secret/zai.db";

        let (status, Json(body)) = command_error(
            "Failed to load transaction",
            Error::Database(DatabaseError::QueryFailed(SENTINEL_SQL.to_string())),
        );

        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(body.code, ErrorCode::Internal);
        assert_eq!(
            body.message,
            "Failed to load transaction: An internal error occurred"
        );
        let serialized = serde_json::to_string(&body).expect("error envelope should serialize");
        assert!(!serialized.contains(SENTINEL_SQL));
        assert!(!serialized.contains(SENTINEL_PATH));
    }

    #[test]
    fn domain_conflict_details_remain_actionable() {
        let (status, Json(body)) = command_error(
            "Failed to update category",
            Error::RevisionConflict {
                current_revision: 12,
            },
        );

        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(body.code, ErrorCode::RevisionConflict);
        assert_eq!(body.details, Some(json!({ "currentRevision": 12 })));
        assert!(body.message.contains("current revision is 12"));
    }

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

    #[test]
    fn calculation_overflow_maps_to_http_conflict() {
        let (status, Json(body)) = command_error(
            "Failed to materialize budget",
            Error::CalculationOverflow("Budget calculation overflow".to_string()),
        );

        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(
            serde_json::to_value(body).expect("error envelope should serialize")["code"],
            "calculationOverflow"
        );
    }
}
