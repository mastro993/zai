use diesel::result::Error as DieselError;
use thiserror::Error;
use zai_db::errors::Error as DatabaseError;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Database operation failed: {0}")]
    Database(#[from] DatabaseError),

    #[error("Unexpected error: {0}")]
    Unexpected(String),
}