mod database_error;

use database_error::DatabaseError;
use std::env;
use std::fs;
use std::path::Path;

/// Initializes the database connection and returns the database path.
/// If the database directory does not exist, it will create it. If it fails, returns an error.
pub fn init(app_data_dir: &str) -> Result<String, DatabaseError> {
    let db_path = get_db_path(app_data_dir);
    let db_dir = Path::new(&db_path).parent().unwrap();
    if !db_dir.exists() {
        fs::create_dir_all(db_dir).map_err(|e| DatabaseError::DirectoryCreation {
            path: db_dir.display().to_string(),
            source: e,
        })?;
    }
    Ok(db_path)
}

/// Returns the database path from the environment variable `DATABASE_URL`.
/// If the variable is not set, it defaults to `<app_data_dir>/zai.db`
pub fn get_db_path(app_data_dir: &str) -> String {
    env::var("DATABASE_URL").unwrap_or_else(|_| format!("{}/zai.db", app_data_dir))
}
