use diesel::result::{DatabaseErrorKind, Error as DieselError};
use thiserror::Error;
use zai_core::{DatabaseError, Error};

pub type Result<T> = std::result::Result<T, StorageError>;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("Failed to create database directory '{path}': {reason}")]
    DirectoryCreation { path: String, reason: String },

    #[error("Database connection failed: {0}")]
    ConnectionFailed(#[from] diesel::ConnectionError),

    #[error("Connection pool error: {0}")]
    PoolError(#[from] r2d2::Error),

    #[error("Query execution failed: {0}")]
    QueryFailed(#[from] DieselError),

    #[error("Database migration failed: {0}")]
    MigrationFailed(String),

    #[error("Core error: {0}")]
    CoreError(#[from] Error),
}

impl From<StorageError> for Error {
    fn from(err: StorageError) -> Self {
        match err {
            StorageError::DirectoryCreation { path, reason } => {
                Error::Database(DatabaseError::DirectoryCreation { path, reason })
            }
            StorageError::ConnectionFailed(err) => {
                Error::Database(DatabaseError::ConnectionFailed(err.to_string()))
            }
            StorageError::PoolError(err) => {
                Error::Database(DatabaseError::PoolCreationFailed(err.to_string()))
            }
            StorageError::QueryFailed(DieselError::NotFound) => {
                Error::Database(DatabaseError::NotFound("Record not found".to_string()))
            }
            StorageError::QueryFailed(DieselError::DatabaseError(
                DatabaseErrorKind::UniqueViolation,
                info,
            )) => Error::Database(DatabaseError::UniqueViolation(info.message().to_string())),
            StorageError::QueryFailed(DieselError::DatabaseError(
                DatabaseErrorKind::ForeignKeyViolation,
                info,
            )) => Error::Database(DatabaseError::ForeignKeyViolation(
                info.message().to_string(),
            )),
            StorageError::QueryFailed(err) if is_sqlite_busy(&err) => {
                Error::Database(DatabaseError::Busy)
            }
            StorageError::QueryFailed(err) => {
                Error::Database(DatabaseError::QueryFailed(err.to_string()))
            }
            StorageError::MigrationFailed(err) => {
                Error::Database(DatabaseError::MigrationFailed(err))
            }
            StorageError::CoreError(err) => err,
        }
    }
}

pub trait IntoCore<T> {
    fn into_core(self) -> zai_core::Result<T>;
}

impl<T, E> IntoCore<T> for std::result::Result<T, E>
where
    StorageError: From<E>,
{
    fn into_core(self) -> zai_core::Result<T> {
        self.map_err(StorageError::from).map_err(Error::from)
    }
}

fn is_sqlite_busy(err: &DieselError) -> bool {
    match err {
        DieselError::DatabaseError(DatabaseErrorKind::Unknown, info) => {
            let message = info.message().to_ascii_lowercase();
            message.contains("database is locked") || message.contains("database is busy")
        }
        DieselError::DatabaseError(_, info) => {
            let message = info.message().to_ascii_lowercase();
            message.contains("database is locked") || message.contains("database is busy")
        }
        _ => {
            let message = err.to_string().to_ascii_lowercase();
            message.contains("database is locked") || message.contains("database is busy")
        }
    }
}

pub trait IntoStorage<T> {
    fn into_storage(self) -> Result<T>;
}

impl<T, E> IntoStorage<T> for std::result::Result<T, E>
where
    StorageError: From<E>,
{
    fn into_storage(self) -> Result<T> {
        self.map_err(StorageError::from)
    }
}
