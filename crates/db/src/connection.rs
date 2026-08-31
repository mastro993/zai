use crate::budgets::BudgetsRepository;
pub use crate::currency::ClientFormat;
use crate::currency::{
    activate_currency_schema, assert_client_format, maybe_confirm_default_currency,
};
use crate::domain_alerts::DomainAlertsRepository;
use crate::errors::{IntoCore, StorageError};
use crate::recurring_transactions::RecurringTransactionsRepository;
use crate::transaction_categories::TransactionCategoriesRepository;
use crate::transactions::TransactionsRepository;
use crate::write_actor::{WriteHandle, spawn_writer};
use diesel::connection::{Connection, SimpleConnection};
use diesel::prelude::QueryableByName;
use diesel::r2d2::{self, ConnectionManager, Pool, PooledConnection};
use diesel::sql_types::Text;
use diesel::sqlite::SqliteConnection;
use diesel::{OptionalExtension, RunQueryDsl};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use log::{error, info};
use std::fs;
#[cfg(unix)]
use std::fs::OpenOptions;
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use zai_core::features::budgets::traits::{CalendarClock, LocalCalendarClock};
use zai_core::features::domain_alerts::DomainAlertEventBus;
use zai_core::{Error, Result};

const PRE_CURRENCY_BACKUP_SUFFIX: &str = ".pre-multi-currency";

pub(crate) type DbPool = Pool<ConnectionManager<SqliteConnection>>;
pub(crate) type DbConnection = PooledConnection<ConnectionManager<SqliteConnection>>;

const MIGRATIONS: EmbeddedMigrations = embed_migrations!();
const DEFAULT_DB_FILENAME: &str = "zai.db";
const DEFAULT_POOL_SIZE: u32 = 8;
const DEFAULT_CONNECTION_TIMEOUT_SECS: u64 = 30;

#[derive(QueryableByName)]
struct MigrationVersionRow {
    #[diesel(sql_type = Text)]
    version: String,
}

pub struct Database {
    db_path: PathBuf,
    pool: Arc<DbPool>,
    writer: WriteHandle,
    clock: Arc<dyn CalendarClock>,
    domain_alert_event_bus: Arc<DomainAlertEventBus>,
}

impl Database {
    pub fn path(&self) -> &Path {
        &self.db_path
    }

    pub fn latest_migration_version(&self) -> Result<Option<String>> {
        let mut connection = get_connection(&self.pool)?;
        diesel::sql_query(
            "SELECT version FROM __diesel_schema_migrations ORDER BY version DESC LIMIT 1",
        )
        .get_result::<MigrationVersionRow>(&mut connection)
        .optional()
        .map(|row| row.map(|row| row.version))
        .into_core()
    }

    pub fn transaction_categories_repository(&self) -> Arc<TransactionCategoriesRepository> {
        Arc::new(
            TransactionCategoriesRepository::new_with_clock_and_publisher(
                Arc::clone(&self.pool),
                self.writer.clone(),
                Arc::clone(&self.clock),
                self.domain_alert_event_bus.clone(),
            ),
        )
    }

    pub fn transactions_repository(&self) -> Arc<TransactionsRepository> {
        Arc::new(TransactionsRepository::new_with_clock_and_publisher(
            Arc::clone(&self.pool),
            self.writer.clone(),
            Arc::clone(&self.clock),
            self.domain_alert_event_bus.clone(),
        ))
    }

    pub fn budgets_repository(&self) -> Arc<BudgetsRepository> {
        Arc::new(BudgetsRepository::new_with_clock_and_publisher(
            Arc::clone(&self.pool),
            self.writer.clone(),
            Arc::clone(&self.clock),
            self.domain_alert_event_bus.clone(),
        ))
    }

    pub fn domain_alerts_repository(&self) -> Arc<DomainAlertsRepository> {
        Arc::new(DomainAlertsRepository::new_with_writer_and_publisher(
            Arc::clone(&self.pool),
            self.writer.clone(),
            self.domain_alert_event_bus.clone(),
        ))
    }

    pub fn currency_settings_repository(&self) -> Arc<crate::currency::CurrencySettingsRepository> {
        Arc::new(crate::currency::CurrencySettingsRepository::new(
            Arc::clone(&self.pool),
            self.writer.clone(),
        ))
    }

    pub fn exchange_rate_repository(&self) -> Arc<crate::exchange_rates::ExchangeRateRepository> {
        Arc::new(crate::exchange_rates::ExchangeRateRepository::new(
            Arc::clone(&self.pool),
            self.writer.clone(),
        ))
    }

    pub fn valuations_repository(&self) -> Arc<crate::valuations::ValuationsRepository> {
        Arc::new(crate::valuations::ValuationsRepository::new(
            Arc::clone(&self.pool),
            self.writer.clone(),
        ))
    }

    pub fn recurring_transactions_repository(&self) -> Arc<RecurringTransactionsRepository> {
        Arc::new(
            RecurringTransactionsRepository::new_with_clock_and_publisher(
                Arc::clone(&self.pool),
                self.writer.clone(),
                Arc::clone(&self.clock),
                self.domain_alert_event_bus.clone(),
            ),
        )
    }

    pub fn domain_alert_event_bus(&self) -> Arc<DomainAlertEventBus> {
        Arc::clone(&self.domain_alert_event_bus)
    }
}

pub fn connect(userdata_dir: impl AsRef<Path>) -> Result<Database> {
    connect_with_client_format(userdata_dir, ClientFormat::MultiCurrencyV1)
}

pub fn connect_with_client_format(
    userdata_dir: impl AsRef<Path>,
    client_format: ClientFormat,
) -> Result<Database> {
    connect_with_event_bus_clock_and_format(
        userdata_dir,
        DomainAlertEventBus::new(),
        Arc::new(LocalCalendarClock),
        client_format,
        true,
    )
}

pub fn connect_with_event_bus(
    userdata_dir: impl AsRef<Path>,
    domain_alert_event_bus: Arc<DomainAlertEventBus>,
) -> Result<Database> {
    connect_with_event_bus_and_clock(
        userdata_dir,
        domain_alert_event_bus,
        Arc::new(LocalCalendarClock),
    )
}

pub fn connect_with_event_bus_and_clock(
    userdata_dir: impl AsRef<Path>,
    domain_alert_event_bus: Arc<DomainAlertEventBus>,
    clock: Arc<dyn CalendarClock>,
) -> Result<Database> {
    connect_with_event_bus_clock_and_format(
        userdata_dir,
        domain_alert_event_bus,
        clock,
        ClientFormat::MultiCurrencyV1,
        true,
    )
}

pub fn open_existing_with_client_format(
    userdata_dir: impl AsRef<Path>,
    client_format: ClientFormat,
) -> Result<Database> {
    connect_with_event_bus_clock_and_format(
        userdata_dir,
        DomainAlertEventBus::new(),
        Arc::new(LocalCalendarClock),
        client_format,
        false,
    )
}

pub fn pre_currency_backup_path(db_path: &Path) -> PathBuf {
    let mut file_name = db_path.file_name().unwrap_or_default().to_os_string();
    file_name.push(PRE_CURRENCY_BACKUP_SUFFIX);
    db_path.with_file_name(file_name)
}

fn connect_with_event_bus_clock_and_format(
    userdata_dir: impl AsRef<Path>,
    domain_alert_event_bus: Arc<DomainAlertEventBus>,
    clock: Arc<dyn CalendarClock>,
    client_format: ClientFormat,
    migrate: bool,
) -> Result<Database> {
    let userdata_dir = userdata_dir.as_ref();
    if !userdata_dir.is_absolute() {
        return Err(Error::InvalidData(format!(
            "Userdata must be an absolute path: '{}'",
            userdata_dir.display()
        )));
    }

    let db_path = userdata_dir.join(DEFAULT_DB_FILENAME);
    init(&db_path)?;
    let pool = if migrate {
        activate_currency_schema(&db_path)?
    } else {
        create_pool(&db_path)?
    };
    maybe_confirm_default_currency(&pool)?;
    assert_client_format(&pool, client_format)?;
    let writer = spawn_writer(pool.as_ref().clone())?;

    Ok(Database {
        db_path,
        pool,
        writer,
        clock,
        domain_alert_event_bus,
    })
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

    create_private_database_file(db_path)?;

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

#[cfg(unix)]
fn create_private_database_file(db_path: &Path) -> Result<()> {
    OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(false)
        .mode(0o600)
        .open(db_path)
        .map(|_| ())
        .map_err(|err| StorageError::FilePreparation {
            path: db_path.display().to_string(),
            reason: err.to_string(),
        })
        .into_core()
}

#[cfg(not(unix))]
fn create_private_database_file(_db_path: &Path) -> Result<()> {
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

#[cfg(test)]
mod tests {
    use super::connect;

    #[test]
    fn connect_rejects_relative_userdata_path() {
        let error = connect("relative-userdata")
            .err()
            .expect("relative Userdata should fail");

        assert!(error.to_string().contains("must be an absolute path"));
    }
}
