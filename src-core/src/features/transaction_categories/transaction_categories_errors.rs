use thiserror::Error;

#[derive(Debug, Error)]
pub enum TransactionCategoryError {
    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid data: {0}")]
    InvalidData(String),
}

impl From<TransactionCategoryError> for diesel::result::Error {
    fn from(err: TransactionCategoryError) -> Self {
        // Convert TransactionCategoryError to a diesel error
        // Using DatabaseError as it's the most appropriate for general errors
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::SerializationFailure,
            Box::new(format!("{}", err)),
        )
    }
}
