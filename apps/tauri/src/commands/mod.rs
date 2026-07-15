use zai_core::{Error as CoreError, ErrorEnvelope};

pub mod budgets;
pub mod domain_alerts;
pub mod transaction_categories;
pub mod transactions;

pub type CommandResult<T> = Result<T, ErrorEnvelope>;

pub fn command_error(context: impl Into<String>, error: CoreError) -> ErrorEnvelope {
    error.to_envelope(context)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use zai_core::Error;

    #[test]
    fn internal_errors_redact_implementation_details() {
        use zai_core::{DatabaseError, ErrorCode};

        const SENTINEL_SQL: &str = "SENTINEL_SQL_SELECT * FROM secrets";
        const SENTINEL_PATH: &str = "/home/user/.secret/zai.db";

        let envelope = command_error(
            "Failed to load transaction",
            Error::Database(DatabaseError::ConnectionFailed(SENTINEL_SQL.to_string())),
        );

        assert_eq!(envelope.code, ErrorCode::Internal);
        assert_eq!(
            envelope.message,
            "Failed to load transaction: An internal error occurred"
        );
        let serialized = serde_json::to_string(&envelope).expect("error envelope should serialize");
        assert!(!serialized.contains(SENTINEL_SQL));
        assert!(!serialized.contains(SENTINEL_PATH));
    }

    #[test]
    fn domain_conflict_details_remain_actionable() {
        use zai_core::ErrorCode;

        let envelope = command_error(
            "Failed to update category",
            Error::RevisionConflict {
                current_revision: 12,
            },
        );

        assert_eq!(envelope.code, ErrorCode::RevisionConflict);
        assert_eq!(envelope.details, Some(json!({ "currentRevision": 12 })));
        assert!(envelope.message.contains("current revision is 12"));
    }

    #[test]
    fn serializes_cash_flow_errors_with_the_shared_envelope() {
        let envelope = command_error(
            "Failed to create transaction",
            Error::InvalidData("Invalid transaction type: transfer".to_string()),
        );

        assert_eq!(
            serde_json::to_value(envelope).expect("error envelope should serialize"),
            json!({
                "code": "validation",
                "message": "Failed to create transaction: Invalid data: Invalid transaction type: transfer"
            })
        );
    }
}
