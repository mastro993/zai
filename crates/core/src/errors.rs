use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    Validation,
    NotFound,
    Conflict,
    NameConflict,
    RevisionConflict,
    BudgetImpactConfirmationRequired,
    CategoryDeletionBlocked,
    PeriodAdvanceLimitExceeded,
    ClockRegression,
    CalculationOverflow,
    Internal,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetImpact {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEnvelope {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl ErrorEnvelope {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details: None,
        }
    }
}

#[derive(Error, Debug)]
pub enum Error {
    #[error("Database operation failed: {0}")]
    Database(#[from] DatabaseError),

    #[error("Repository error: {0}")]
    Repository(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid data: {0}")]
    Conflict(String),

    #[error("Name conflict: {0}")]
    NameConflict(String),

    #[error("Budget revision conflict; current revision is {current_revision}")]
    RevisionConflict { current_revision: i64 },

    #[error("Category change affects budget results and requires confirmation")]
    BudgetImpactConfirmationRequired { affected_budgets: Vec<BudgetImpact> },

    #[error("Category deletion is blocked because a current budget selects the category directly")]
    CategoryDeletionBlocked {
        category_ids: Vec<String>,
        affected_budgets: Vec<BudgetImpact>,
    },

    #[error("Budget period advance limit exceeded: {0}")]
    PeriodAdvanceLimitExceeded(String),

    #[error("Budget calendar clock regression: {0}")]
    ClockRegression(String),

    #[error("Budget calculation overflow: {0}")]
    CalculationOverflow(String),

    #[error("Invalid data: {0}")]
    InvalidData(String),

    #[error("Unexpected error: {0}")]
    Unexpected(String),
}

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("Failed to create database directory '{path}': {reason}")]
    DirectoryCreation { path: String, reason: String },

    #[error("Failed to create database connection pool: {0}")]
    PoolCreationFailed(String),

    #[error("Failed to connect to the database: {0}")]
    ConnectionFailed(String),

    #[error("Failed to execute query: {0}")]
    QueryFailed(String),

    #[error("Record not found: {0}")]
    NotFound(String),

    #[error("Unique constraint violation: {0}")]
    UniqueViolation(String),

    #[error("Foreign key violation: {0}")]
    ForeignKeyViolation(String),

    #[error("Database transaction failed: {0}")]
    TransactionFailed(String),

    #[error("Database migration failed: {0}")]
    MigrationFailed(String),

    #[error("Internal database error: {0}")]
    Internal(String),
}

const INTERNAL_PUBLIC_MESSAGE: &str = "An internal error occurred";

impl Error {
    pub fn exposes_internal_details(&self) -> bool {
        match self {
            Self::Repository(_) | Self::Unexpected(_) => true,
            Self::Database(db_error) => matches!(
                db_error,
                DatabaseError::DirectoryCreation { .. }
                    | DatabaseError::PoolCreationFailed(_)
                    | DatabaseError::ConnectionFailed(_)
                    | DatabaseError::QueryFailed(_)
                    | DatabaseError::TransactionFailed(_)
                    | DatabaseError::MigrationFailed(_)
                    | DatabaseError::Internal(_)
            ),
            _ => false,
        }
    }

    pub fn public_message(&self) -> String {
        if self.exposes_internal_details() {
            INTERNAL_PUBLIC_MESSAGE.to_string()
        } else {
            self.to_string()
        }
    }

    pub fn code(&self) -> ErrorCode {
        match self {
            Self::InvalidData(_) => ErrorCode::Validation,
            Self::NotFound(_) => ErrorCode::NotFound,
            Self::Conflict(_) => ErrorCode::Conflict,
            Self::NameConflict(_) => ErrorCode::NameConflict,
            Self::RevisionConflict { .. } => ErrorCode::RevisionConflict,
            Self::BudgetImpactConfirmationRequired { .. } => {
                ErrorCode::BudgetImpactConfirmationRequired
            }
            Self::CategoryDeletionBlocked { .. } => ErrorCode::CategoryDeletionBlocked,
            Self::PeriodAdvanceLimitExceeded(_) => ErrorCode::PeriodAdvanceLimitExceeded,
            Self::ClockRegression(_) => ErrorCode::ClockRegression,
            Self::CalculationOverflow(_) => ErrorCode::CalculationOverflow,
            Self::Database(DatabaseError::NotFound(_)) => ErrorCode::NotFound,
            Self::Database(DatabaseError::UniqueViolation(_))
            | Self::Database(DatabaseError::ForeignKeyViolation(_)) => ErrorCode::Conflict,
            Self::Database(_) | Self::Repository(_) | Self::Unexpected(_) => ErrorCode::Internal,
        }
    }

    pub fn to_envelope(self, context: impl Into<String>) -> ErrorEnvelope {
        let code = self.code();
        let details = match &self {
            Self::RevisionConflict { current_revision } => {
                Some(serde_json::json!({ "currentRevision": current_revision }))
            }
            Self::BudgetImpactConfirmationRequired { affected_budgets } => {
                Some(serde_json::json!({ "affectedBudgets": affected_budgets }))
            }
            Self::CategoryDeletionBlocked {
                category_ids,
                affected_budgets,
            } => Some(serde_json::json!({
                "categoryIds": category_ids,
                "affectedBudgets": affected_budgets,
            })),
            _ => None,
        };
        let context = context.into();
        let message = format!("{}: {}", context, self.public_message());
        ErrorEnvelope {
            code,
            message,
            details,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SENTINEL_SQL: &str = "SENTINEL_SQL_SELECT * FROM secrets";
    const SENTINEL_PATH: &str = "/home/user/.secret/zai.db";

    fn envelope_for(error: Error) -> ErrorEnvelope {
        error.to_envelope("Operation failed")
    }

    fn assert_redacted(envelope: &ErrorEnvelope) {
        assert_eq!(envelope.code, ErrorCode::Internal);
        assert_eq!(
            envelope.message,
            "Operation failed: An internal error occurred"
        );
        assert!(!envelope.message.contains(SENTINEL_SQL));
        assert!(!envelope.message.contains(SENTINEL_PATH));
    }

    #[test]
    fn internal_errors_redact_implementation_details() {
        let cases = [
            Error::Repository(format!("repo failure {SENTINEL_SQL}")),
            Error::Unexpected(format!("unexpected failure {SENTINEL_PATH}")),
            Error::Database(DatabaseError::DirectoryCreation {
                path: SENTINEL_PATH.to_string(),
                reason: "permission denied".to_string(),
            }),
            Error::Database(DatabaseError::PoolCreationFailed(SENTINEL_PATH.to_string())),
            Error::Database(DatabaseError::ConnectionFailed(SENTINEL_SQL.to_string())),
            Error::Database(DatabaseError::QueryFailed(SENTINEL_SQL.to_string())),
            Error::Database(DatabaseError::TransactionFailed(SENTINEL_SQL.to_string())),
            Error::Database(DatabaseError::MigrationFailed(SENTINEL_PATH.to_string())),
            Error::Database(DatabaseError::Internal(SENTINEL_SQL.to_string())),
        ];

        for error in cases {
            assert_redacted(&envelope_for(error));
        }
    }

    #[test]
    fn actionable_errors_preserve_domain_messages() {
        let cases = [
            (
                Error::InvalidData("amount must be positive".to_string()),
                ErrorCode::Validation,
                "Invalid data: amount must be positive",
            ),
            (
                Error::NotFound("txn-404".to_string()),
                ErrorCode::NotFound,
                "Not found: txn-404",
            ),
            (
                Error::Conflict("category is in use".to_string()),
                ErrorCode::Conflict,
                "Invalid data: category is in use",
            ),
            (
                Error::NameConflict("Food".to_string()),
                ErrorCode::NameConflict,
                "Name conflict: Food",
            ),
            (
                Error::PeriodAdvanceLimitExceeded("limit reached".to_string()),
                ErrorCode::PeriodAdvanceLimitExceeded,
                "Budget period advance limit exceeded: limit reached",
            ),
            (
                Error::ClockRegression("clock moved backward".to_string()),
                ErrorCode::ClockRegression,
                "Budget calendar clock regression: clock moved backward",
            ),
            (
                Error::CalculationOverflow("overflow".to_string()),
                ErrorCode::CalculationOverflow,
                "Budget calculation overflow: overflow",
            ),
            (
                Error::Database(DatabaseError::NotFound("txn-404".to_string())),
                ErrorCode::NotFound,
                "Database operation failed: Record not found: txn-404",
            ),
            (
                Error::Database(DatabaseError::UniqueViolation(
                    "A category already exists".to_string(),
                )),
                ErrorCode::Conflict,
                "Database operation failed: Unique constraint violation: A category already exists",
            ),
            (
                Error::Database(DatabaseError::ForeignKeyViolation(
                    "category is referenced".to_string(),
                )),
                ErrorCode::Conflict,
                "Database operation failed: Foreign key violation: category is referenced",
            ),
        ];

        for (error, expected_code, expected_suffix) in cases {
            let envelope = envelope_for(error);
            assert_eq!(envelope.code, expected_code);
            assert_eq!(
                envelope.message,
                format!("Operation failed: {expected_suffix}")
            );
        }
    }

    #[test]
    fn structured_domain_errors_preserve_details_and_safe_messages() {
        let revision = envelope_for(Error::RevisionConflict {
            current_revision: 7,
        });
        assert_eq!(revision.code, ErrorCode::RevisionConflict);
        assert_eq!(
            revision.details,
            Some(serde_json::json!({ "currentRevision": 7 }))
        );
        assert!(revision.message.contains("current revision is 7"));

        let budget_impact = envelope_for(Error::BudgetImpactConfirmationRequired {
            affected_budgets: vec![BudgetImpact {
                id: "budget-1".to_string(),
                name: "Monthly food".to_string(),
            }],
        });
        assert_eq!(
            budget_impact.code,
            ErrorCode::BudgetImpactConfirmationRequired
        );
        assert_eq!(
            budget_impact.details,
            Some(serde_json::json!({
                "affectedBudgets": [{ "id": "budget-1", "name": "Monthly food" }]
            }))
        );
        assert!(budget_impact.message.contains("requires confirmation"));

        let deletion_blocked = envelope_for(Error::CategoryDeletionBlocked {
            category_ids: vec!["food".to_string()],
            affected_budgets: Vec::new(),
        });
        assert_eq!(deletion_blocked.code, ErrorCode::CategoryDeletionBlocked);
        assert_eq!(
            deletion_blocked.details,
            Some(serde_json::json!({
                "categoryIds": ["food"],
                "affectedBudgets": []
            }))
        );
        assert!(deletion_blocked.message.contains("blocked"));
    }

    #[test]
    fn budget_impact_errors_preserve_affected_budget_details() {
        let envelope = Error::BudgetImpactConfirmationRequired {
            affected_budgets: vec![BudgetImpact {
                id: "budget-1".to_string(),
                name: "Monthly food".to_string(),
            }],
        }
        .to_envelope("Failed to update category");

        assert_eq!(envelope.code, ErrorCode::BudgetImpactConfirmationRequired);
        assert_eq!(
            envelope.details,
            Some(serde_json::json!({
                "affectedBudgets": [{ "id": "budget-1", "name": "Monthly food" }]
            }))
        );
    }

    #[test]
    fn direct_category_deletion_uses_distinct_structured_error_code() {
        let envelope = Error::CategoryDeletionBlocked {
            category_ids: vec!["food".to_string()],
            affected_budgets: Vec::new(),
        }
        .to_envelope("Failed to delete category");

        assert_eq!(envelope.code, ErrorCode::CategoryDeletionBlocked);
        assert_eq!(
            envelope.details,
            Some(serde_json::json!({
                "categoryIds": ["food"],
                "affectedBudgets": []
            }))
        );
    }

    #[test]
    fn calculation_overflow_uses_distinct_structured_error_code() {
        let envelope = Error::CalculationOverflow("Budget calculation overflow".to_string())
            .to_envelope("Failed to materialize budget");

        assert_eq!(envelope.code, ErrorCode::CalculationOverflow);
    }
}
