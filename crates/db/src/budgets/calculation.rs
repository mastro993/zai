use diesel::result::{DatabaseErrorKind, Error as DieselError};
use zai_core::Error;

use crate::errors::StorageError;

pub(crate) fn map_budget_insert_error(error: DieselError) -> StorageError {
    match error {
        DieselError::DatabaseError(DatabaseErrorKind::UniqueViolation, _) => {
            StorageError::CoreError(Error::NameConflict(
                "An active budget with this name already exists".to_string(),
            ))
        }
        error => StorageError::from(error),
    }
}
