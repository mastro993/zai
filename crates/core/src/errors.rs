use crate::database::errors::DatabaseError;
use diesel::result::Error as DieselError;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Database operation failed: {0}")]
    Database(#[from] DatabaseError),

    #[error("Repository error: {0}")]
    Repository(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid data: {0}")]
    InvalidData(String),

    #[error("Unexpected error: {0}")]
    Unexpected(String),
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
