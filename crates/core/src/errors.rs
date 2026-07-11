use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    Validation,
    NotFound,
    Conflict,
    Internal,
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

impl Error {
    pub fn code(&self) -> ErrorCode {
        match self {
            Self::InvalidData(_) => ErrorCode::Validation,
            Self::NotFound(_) => ErrorCode::NotFound,
            Self::Conflict(_) => ErrorCode::Conflict,
            Self::Database(DatabaseError::NotFound(_)) => ErrorCode::NotFound,
            Self::Database(DatabaseError::UniqueViolation(_))
            | Self::Database(DatabaseError::ForeignKeyViolation(_)) => ErrorCode::Conflict,
            Self::Database(_) | Self::Repository(_) | Self::Unexpected(_) => ErrorCode::Internal,
        }
    }

    pub fn to_envelope(self, context: impl Into<String>) -> ErrorEnvelope {
        let code = self.code();
        let message = format!("{}: {self}", context.into());
        ErrorEnvelope::new(code, message)
    }
}
