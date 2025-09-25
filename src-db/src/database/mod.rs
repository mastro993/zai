use log::{error, info};
use std::env;
use std::fs;
use std::path::Path;
use std::sync::Arc;

use diesel::connection::{Connection, SimpleConnection};
use diesel::r2d2;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};
use diesel::sqlite::SqliteConnection;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

pub mod write_actor;
mod test_utils;
pub use test_utils::*;

use crate::errors::{Error, InternalDatabaseError, Result};
pub use write_actor::WriteHandle;

/// Type alias for the database connection pool.
///
/// This represents a pool of SQLite connections managed by r2d2, providing
/// efficient connection reuse and automatic connection management.
pub type DbPool = Pool<ConnectionManager<SqliteConnection>>;

/// Type alias for a pooled database connection.
///
/// This represents a single connection obtained from the connection pool,
/// which is automatically returned to the pool when dropped.
pub type DbConnection = PooledConnection<ConnectionManager<SqliteConnection>>;

/// Embedded database migrations.
///
/// This constant contains all migration files embedded at compile time,
/// allowing the application to run migrations without external files.
/// The migrations are loaded from the `migrations/` directory.
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!();

/// Default database filename used when no DATABASE_URL is specified.
const DEFAULT_DB_FILENAME: &str = "zai.db";

/// Default connection pool size.
const DEFAULT_POOL_SIZE: u32 = 8;

/// Default connection timeout in seconds.
const DEFAULT_CONNECTION_TIMEOUT_SECS: u64 = 30;

/// Retrieves the database file path from configuration.
///
/// This function checks for the `DATABASE_URL` environment variable first.
/// If not found, it constructs a default path using the provided app data directory.
pub fn get_db_path(app_data_dir: &str) -> String {
    env::var("DATABASE_URL").unwrap_or_else(|_| format!("{}/{}", app_data_dir, DEFAULT_DB_FILENAME))
}

/// Initializes the database by ensuring the directory structure exists and configuring SQLite.
///
/// This function prepares the database environment by:
/// 1. Determining the database file path (from env var or default)
/// 2. Creating the parent directory if it doesn't exist
/// 3. Establishing a connection to configure SQLite PRAGMA settings
/// 4. Setting up WAL mode, foreign keys, busy timeout, and synchronous mode
/// 5. Returning the database path for further use
pub fn init(app_data_dir: &str) -> Result<String> {
    let db_path = get_db_path(app_data_dir);
    let db_dir = Path::new(&db_path).parent().unwrap();

    if !db_dir.exists() {
        fs::create_dir_all(db_dir).map_err(|e| {
            error!(
                "Failed to create database directory '{}': {}",
                db_dir.display(),
                e
            );
            Error::InternalDatabase(InternalDatabaseError::DirectoryCreation {
                path: db_dir.display().to_string(),
                source: e,
            })
        })?;
    }

    {
        let mut conn = SqliteConnection::establish(&db_path).map_err(|e| {
            error!("Failed to connect to the database: {}", e);
            Error::InternalDatabase(InternalDatabaseError::ConnectionFailed(e.to_string()))
        })?;
        conn.batch_execute(
            "\n            PRAGMA journal_mode = WAL;\n            PRAGMA foreign_keys = ON;\n            PRAGMA busy_timeout = 30000;\n            PRAGMA synchronous  = NORMAL;\n        ",
        ).map_err(|e| {
            error!("Failed to execute batch PRAGMA statements: {}", e);
            Error::InternalDatabase(InternalDatabaseError::QueryFailed(e))
        })?;
    }

    Ok(db_path)
}

/// Creates a configured database connection pool.
///
/// This function sets up a r2d2 connection pool with optimized settings for SQLite:
/// - Maximum pool size for concurrent connections
/// - Minimum idle connections for quick access
/// - Connection timeout to prevent hanging
/// - Custom connection configuration (PRAGMA settings)
pub fn create_pool(db_path: &str) -> Result<Arc<DbPool>> {
    let manager = ConnectionManager::<SqliteConnection>::new(db_path);
    let pool = Pool::builder()
        .max_size(DEFAULT_POOL_SIZE)
        .min_idle(Some(1)) // Keep at least one connection ready
        .connection_timeout(std::time::Duration::from_secs(
            DEFAULT_CONNECTION_TIMEOUT_SECS,
        ))
        .connection_customizer(Box::new(ConnectionCustomizer {}))
        .build(manager)
        .map_err(InternalDatabaseError::PoolCreationFailed)?;

    Ok(Arc::new(pool))
}

/// Retrieves a database connection from the connection pool.
///
/// This function gets a connection from the pool, which will be automatically
/// returned to the pool when the connection is dropped. The connection is ready
/// for immediate use with all SQLite optimizations applied.
pub fn get_connection(pool: &Pool<ConnectionManager<SqliteConnection>>) -> Result<DbConnection> {
    pool.get().map_err(|e| {
        error!("Failed to get a connection from the pool: {}", e);
        Error::InternalDatabase(InternalDatabaseError::ConnectionFailed(e.to_string()))
    })
}

/// Executes pending database migrations.
///
/// This function applies any pending migrations to bring the database schema
/// up to date. It uses embedded migrations that are compiled into the binary,
/// ensuring consistent schema versioning across deployments.
pub fn run_migrations(pool: &DbPool) -> Result<()> {
    info!("Running database migrations");
    let mut connection = get_connection(pool)?;

    let result = connection.run_pending_migrations(MIGRATIONS).map_err(|e| {
        error!("Database migration failed: {}", e);
        Error::InternalDatabase(InternalDatabaseError::MigrationFailed(e.to_string()))
    })?;

    if result.is_empty() {
        info!("No pending migrations to apply.");
    } else {
        info!("Applied the following migrations:");
        for migration_version in &result {
            info!("  - {}", migration_version);
        }
    }

    Ok(())
}

/// Custom connection initializer for SQLite connections.
///
/// This struct implements connection customization to apply SQLite-specific
/// optimizations and settings when connections are acquired from the pool.
///
/// # PRAGMA Settings Applied
///
/// * `foreign_keys = ON` - Enables foreign key constraint enforcement
/// * `busy_timeout = 30000` - Sets busy timeout to 30 seconds for locked databases
/// * `synchronous = NORMAL` - Balances safety and performance for WAL mode
///
/// These settings optimize SQLite for concurrent access while maintaining
/// data integrity and reasonable performance characteristics.
#[derive(Debug)]
struct ConnectionCustomizer;

impl r2d2::CustomizeConnection<SqliteConnection, diesel::r2d2::Error> for ConnectionCustomizer {
    /// Configures a new connection when it's acquired from the pool.
    ///
    /// This method is called automatically by r2d2 whenever a new connection
    /// is established or retrieved from the pool.
    fn on_acquire(
        &self,
        conn: &mut SqliteConnection,
    ) -> std::result::Result<(), diesel::r2d2::Error> {
        use diesel::RunQueryDsl;

        diesel::sql_query(
            "\n            PRAGMA foreign_keys = ON;\n            PRAGMA busy_timeout = 30000;\n            PRAGMA synchronous = NORMAL;\n        ",
        )
            .execute(conn)
            .map_err(r2d2::Error::QueryError)?;

        Ok(())
    }
}
