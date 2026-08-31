use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};

use serde::Serialize;
use zai_db::Database;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReport {
    pub operating_system: &'static str,
    pub architecture: &'static str,
    pub database: DatabaseDiagnostics,
    pub logs: Option<LogDiagnostics>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseDiagnostics {
    pub path: String,
    pub size_bytes: Option<u64>,
    pub schema_version: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogDiagnostics {
    pub path: String,
    pub size_bytes: Option<u64>,
}

pub(crate) fn collect(database: &Database, log_dir: Option<&Path>) -> DiagnosticsReport {
    let database_path =
        fs::canonicalize(database.path()).unwrap_or_else(|_| database.path().to_path_buf());

    DiagnosticsReport {
        operating_system: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
        database: DatabaseDiagnostics {
            path: database_path.to_string_lossy().into_owned(),
            size_bytes: database_footprint(database.path()),
            schema_version: database.latest_migration_version().ok().flatten(),
        },
        logs: log_dir.map(|path| LogDiagnostics {
            path: path.to_string_lossy().into_owned(),
            size_bytes: directory_size(path),
        }),
    }
}

fn database_footprint(path: &Path) -> Option<u64> {
    let mut total = fs::metadata(path).ok()?.len();

    for suffix in ["-wal", "-shm"] {
        if let Some(size) = optional_file_size(&with_suffix(path, suffix))? {
            total = total.checked_add(size)?;
        }
    }

    Some(total)
}

fn optional_file_size(path: &Path) -> Option<Option<u64>> {
    match fs::metadata(path) {
        Ok(metadata) if metadata.is_file() => Some(Some(metadata.len())),
        Ok(_) => None,
        Err(error) if error.kind() == ErrorKind::NotFound => Some(None),
        Err(_) => None,
    }
}

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut value = path.as_os_str().to_os_string();
    value.push(suffix);
    PathBuf::from(value)
}

fn directory_size(path: &Path) -> Option<u64> {
    let mut entries = fs::read_dir(path).ok()?;
    entries.try_fold(0_u64, |total, entry| {
        let entry = entry.ok()?;
        if !entry.file_type().ok()?.is_file() {
            return Some(total);
        }
        total.checked_add(entry.metadata().ok()?.len())
    })
}

#[cfg(test)]
mod tests {
    use std::{env, fs};

    use uuid::Uuid;

    use super::database_footprint;

    #[test]
    fn database_footprint_includes_wal_and_shm_files() {
        let root = env::temp_dir().join(format!("zai-diagnostics-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("temp diagnostics directory should be created");
        let database = root.join("zai.db");
        fs::write(&database, [0_u8; 2]).expect("database fixture should be written");
        fs::write(root.join("zai.db-wal"), [0_u8; 3]).expect("wal fixture should be written");
        fs::write(root.join("zai.db-shm"), [0_u8; 5]).expect("shm fixture should be written");

        assert_eq!(database_footprint(&database), Some(10));

        fs::remove_dir_all(root).expect("temp diagnostics directory should be removed");
    }
}
