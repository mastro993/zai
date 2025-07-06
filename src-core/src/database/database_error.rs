use thiserror::Error;

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("Failed to create database directory '{path}': {source}")]
    DirectoryCreation {
        path: String,
        source: std::io::Error,
    },
}
