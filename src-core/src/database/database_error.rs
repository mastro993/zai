use thiserror::Error;

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("Failed to create database directory '{path}': {source}")]
    DirectoryCreation {
        path: String,
        source: std::io::Error,
    },
    #[error("Failed to connect to the database: {0}")]
    ConnectionPool(String),
    #[error("Database migration failed: {0}")]
    MigrationFailed(String),
    #[error("Failed to create database connection pool: {0}")]
    PoolCreationFailed(#[from] r2d2::Error),
}
