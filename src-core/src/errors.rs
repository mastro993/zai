use diesel::result::Error as DieselError;
use thiserror::Error;
use zai_database::errors::DatabaseError;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Database operation failed: {0}")]
    Database(#[from] DatabaseError),

    #[error("Unexpected error: {0}")]
    Unexpected(String),
}

// Implement From for DieselError to Error directly
impl From<DieselError> for Error {
    fn from(err: DieselError) -> Self {
        Error::Database(DatabaseError::QueryFailed(err))
    }
}