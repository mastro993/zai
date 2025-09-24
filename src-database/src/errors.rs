use diesel::result::Error as DieselError;
use thiserror::Error;

use crate::repositories::transaction_categories::TransactionCategoryError;


// Create a type alias for Result using our Error type
pub type Result<T> = std::result::Result<T, Error>;

/// Root error type for the portfolio application
#[derive(Error, Debug)]
pub enum Error {
    #[error("Database operation failed: {0}")]
    Database(#[from] DatabaseError),

    #[error("Transaction category error: {0}")]
    TransactionCategory(#[from] TransactionCategoryError),

    #[error("Repository error: {0}")]
    Repository(String),

    #[error("Unexpected error: {0}")]
    Unexpected(String),
}

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("Failed to create database directory '{path}': {source}")]
    DirectoryCreation {
        path: String,
        source: std::io::Error,
    },
    #[error("Failed to create database connection pool: {0}")]
    PoolCreationFailed(#[from] r2d2::Error),
    #[error("Failed to connect to the database: {0}")]
    ConnectionFailed(String),
    #[error("Failed to execute query: {0}")]
    QueryFailed(#[from] DieselError),
    #[error("Database migration failed: {0}")]
    MigrationFailed(String),
}

impl From<DieselError> for Error {
    fn from(err: DieselError) -> Self {
        Error::Database(DatabaseError::QueryFailed(err))
    }
}

impl From<r2d2::Error> for Error {
    fn from(e: r2d2::Error) -> Self {
        Error::Database(DatabaseError::PoolCreationFailed(e))
    }
}
