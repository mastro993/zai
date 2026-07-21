use thiserror::Error;

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

    #[error("Database temporarily locked")]
    Busy,

    #[error("Internal database error: {0}")]
    Internal(String),
}
