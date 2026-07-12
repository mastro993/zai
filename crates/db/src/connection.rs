use crate::budgets::BudgetsRepository;
use crate::errors::{IntoCore, StorageError};
use crate::transaction_categories::TransactionCategoriesRepository;
use crate::transactions::TransactionsRepository;
use crate::write_actor::{WriteHandle, spawn_writer};
use diesel::connection::{Connection, SimpleConnection};
use diesel::r2d2::{self, ConnectionManager, Pool, PooledConnection};
use diesel::sqlite::SqliteConnection;
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use log::{error, info};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::budgets::traits::{CalendarClock, LocalCalendarClock};

pub(crate) type DbPool = Pool<ConnectionManager<SqliteConnection>>;
pub(crate) type DbConnection = PooledConnection<ConnectionManager<SqliteConnection>>;

const MIGRATIONS: EmbeddedMigrations = embed_migrations!();
const DEFAULT_DB_FILENAME: &str = "zai.db";
const DEFAULT_POOL_SIZE: u32 = 8;
const DEFAULT_CONNECTION_TIMEOUT_SECS: u64 = 30;

pub struct Database {
    db_path: PathBuf,
    pool: Arc<DbPool>,
    writer: WriteHandle,
    clock: Arc<dyn CalendarClock>,
}

impl Database {
    pub fn path(&self) -> &Path {
        &self.db_path
    }

    pub fn transaction_categories_repository(&self) -> Arc<TransactionCategoriesRepository> {
        Arc::new(TransactionCategoriesRepository::new_with_clock(
            Arc::clone(&self.pool),
            self.writer.clone(),
            Arc::clone(&self.clock),
        ))
    }

    pub fn transactions_repository(&self) -> Arc<TransactionsRepository> {
        Arc::new(TransactionsRepository::new_with_clock(
            Arc::clone(&self.pool),
            self.writer.clone(),
            Arc::clone(&self.clock),
        ))
    }

    pub fn budgets_repository(&self) -> Arc<BudgetsRepository> {
        Arc::new(BudgetsRepository::new_with_clock(
            Arc::clone(&self.pool),
            self.writer.clone(),
            Arc::clone(&self.clock),
        ))
    }
}

pub fn connect(app_data_dir: impl AsRef<Path>) -> Result<Database> {
    let db_path = get_db_path(app_data_dir.as_ref());
    init(&db_path)?;
    let pool = create_pool(&db_path)?;
    run_migrations(&pool)?;
    let writer = spawn_writer(pool.as_ref().clone())?;
    let clock: Arc<dyn CalendarClock> = Arc::new(LocalCalendarClock);

    Ok(Database {
        db_path,
        pool,
        writer,
        clock,
    })
}

fn get_db_path(app_data_dir: &Path) -> PathBuf {
    env::var_os("DATABASE_URL")
        .map(PathBuf::from)
        .unwrap_or_else(|| app_data_dir.join(DEFAULT_DB_FILENAME))
}

fn init(db_path: &Path) -> Result<()> {
    if let Some(db_dir) = db_path.parent()
        && !db_dir.exists()
    {
        fs::create_dir_all(db_dir)
            .map_err(|err| StorageError::DirectoryCreation {
                path: db_dir.display().to_string(),
                reason: err.to_string(),
            })
            .into_core()?;
    }

    let mut conn = SqliteConnection::establish(db_path.to_string_lossy().as_ref())
        .map_err(|err| {
            error!("Failed to connect to the database: {}", err);
            err
        })
        .into_core()?;

    conn.batch_execute(
        "\n            PRAGMA journal_mode = WAL;\n            PRAGMA foreign_keys = ON;\n            PRAGMA busy_timeout = 30000;\n            PRAGMA synchronous  = NORMAL;\n        ",
    )
    .into_core()?;

    Ok(())
}

pub(crate) fn create_pool(db_path: &Path) -> Result<Arc<DbPool>> {
    let manager = ConnectionManager::<SqliteConnection>::new(db_path.to_string_lossy().as_ref());
    let pool = Pool::builder()
        .max_size(DEFAULT_POOL_SIZE)
        .min_idle(Some(1))
        .connection_timeout(std::time::Duration::from_secs(
            DEFAULT_CONNECTION_TIMEOUT_SECS,
        ))
        .connection_customizer(Box::new(ConnectionCustomizer {}))
        .build(manager)
        .into_core()?;

    Ok(Arc::new(pool))
}

pub(crate) fn get_connection(pool: &DbPool) -> Result<DbConnection> {
    pool.get()
        .map_err(|err| {
            error!("Failed to get a connection from the pool: {}", err);
            err
        })
        .into_core()
}

pub(crate) fn run_migrations(pool: &DbPool) -> Result<()> {
    info!("Running database migrations");
    let mut connection = get_connection(pool)?;

    let result = connection
        .run_pending_migrations(MIGRATIONS)
        .map_err(|err| StorageError::MigrationFailed(err.to_string()))
        .into_core()?;

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

#[derive(Debug)]
struct ConnectionCustomizer;

impl r2d2::CustomizeConnection<SqliteConnection, diesel::r2d2::Error> for ConnectionCustomizer {
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
