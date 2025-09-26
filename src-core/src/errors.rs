use crate::database::errors::DatabaseError;
use crate::features::transaction_categories::transaction_categories_errors::TransactionCategoryError;
use diesel::result::Error as DieselError;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

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
