use diesel::result::Error as DieselError;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;


#[derive(Error, Debug)]
pub enum Error {
    #[error("Database operation failed: {0}")]
    Database(#[from] DatabaseError),

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

// Implement From for DieselError to Error directly
impl From<DieselError> for Error {
    fn from(err: DieselError) -> Self {
        Error::Database(DatabaseError::QueryFailed(err))
    }
}