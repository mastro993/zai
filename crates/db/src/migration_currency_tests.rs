use crate::connection::{
    ClientFormat, connect_with_client_format, open_existing_with_client_format,
    pre_currency_backup_path,
};
use crate::currency::activate_currency_schema;
use crate::currency::failpoints::{self, CurrencyMigrationFailpoint};
use crate::migration_fixture_support::{
    CountRow, RELEASED_SCHEMA_FIXTURES, TEST_MIGRATIONS, assert_db_integrity,
    load_released_schema_fixture,
};
use crate::test_utils::TempDb;
use diesel::Connection;
use diesel::RunQueryDsl;
use diesel::connection::SimpleConnection;
use diesel::prelude::QueryableByName;
use diesel::sqlite::SqliteConnection;
use diesel_migrations::MigrationHarness;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use zai_core::features::currency::CurrencySettingsPort;
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;
use zai_core::{Error, ErrorCode};

#[derive(QueryableByName)]
struct TextRow {
    #[diesel(sql_type = diesel::sql_types::Text)]
    value: String,
}

struct StagedAppDir {
    path: PathBuf,
}

impl StagedAppDir {
    fn from_fixture(fixture_name: &str, seed_sql: &str) -> Self {
        let path = std::env::temp_dir().join(format!("zai-currency-stage-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).expect("stage dir");
        let db_path = path.join("zai.db");
        let mut connection =
            SqliteConnection::establish(db_path.to_str().expect("utf8")).expect("stage connect");
        load_released_schema_fixture(&mut connection, fixture_name);
        connection
            .batch_execute(seed_sql)
            .unwrap_or_else(|err| panic!("seed {fixture_name}: {err}"));
        Self { path }
    }

    fn path(&self) -> &Path {
        &self.path
    }

    fn db_path(&self) -> PathBuf {
        self.path.join("zai.db")
    }
}

impl Drop for StagedAppDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn refuse_open<T>(result: zai_core::Result<T>, message: &str) -> zai_core::Error {
    match result {
        Ok(_) => panic!("{message}"),
        Err(error) => error,
    }
}

fn v0009() -> &'static crate::migration_fixture_support::ReleasedSchemaFixture {
    RELEASED_SCHEMA_FIXTURES
        .iter()
        .find(|fixture| fixture.name == "v0009_recurring_transactions")
        .expect("v0009 fixture")
}

fn reopen(db_path: &Path) -> SqliteConnection {
    let mut connection =
        SqliteConnection::establish(db_path.to_str().expect("utf8")).expect("reopen");
    connection
        .batch_execute("PRAGMA busy_timeout = 30000;")
        .expect("busy timeout");
    connection
}

fn count(connection: &mut SqliteConnection, sql: &str) -> i64 {
    diesel::sql_query(sql)
        .get_result::<CountRow>(connection)
        .expect("count")
        .count
}

fn text_values(connection: &mut SqliteConnection, sql: &str) -> Vec<String> {
    diesel::sql_query(sql)
        .load::<TextRow>(connection)
        .expect("text rows")
        .into_iter()
        .map(|row| row.value)
        .collect()
}

#[tokio::test]
async fn first_launch_creates_backup_assigns_eur_records_format_then_opens() {
    let fixture = v0009();
    let staged = StagedAppDir::from_fixture(fixture.name, fixture.seed_sql);
    let before_amounts = {
        let mut connection =
            SqliteConnection::establish(staged.db_path().to_str().expect("utf8")).expect("read");
        (
            text_values(
                &mut connection,
                "SELECT CAST(amount AS TEXT) AS value FROM transactions ORDER BY id",
            ),
            text_values(
                &mut connection,
                "SELECT CAST(amount AS TEXT) AS value FROM recurring_template_revisions ORDER BY id",
            ),
        )
    };

    let pool = activate_currency_schema(&staged.db_path()).expect("activate silent EUR");
    drop(pool);

    let backup = pre_currency_backup_path(&staged.db_path());
    assert!(backup.exists(), "pre-migration backup must exist");

    let mut connection =
        SqliteConnection::establish(staged.db_path().to_str().expect("utf8")).expect("reopen");
    assert_db_integrity(&mut connection);
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM application_format WHERE format = 'multi-currency-v1'"
        ),
        1
    );
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM transactions WHERE currency != 'EUR'"
        ),
        0
    );
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM recurring_template_revisions WHERE currency != 'EUR'"
        ),
        0
    );
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM transaction_exchange_rate_revisions \
             WHERE variant != 'identity'"
        ),
        0
    );
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM transactions"
        ),
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM transaction_exchange_rate_revisions"
        )
    );
    assert_eq!(
        text_values(
            &mut connection,
            "SELECT CAST(amount AS TEXT) AS value FROM transactions ORDER BY id"
        ),
        before_amounts.0
    );
    assert_eq!(
        text_values(
            &mut connection,
            "SELECT CAST(amount AS TEXT) AS value FROM recurring_template_revisions ORDER BY id"
        ),
        before_amounts.1
    );
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM currency_settings \
             WHERE default_currency = 'EUR' AND setup_completed_at IS NULL"
        ),
        1
    );
}

#[test]
fn upgrade_preserves_fulfilled_occurrence_relationships() {
    let fixture = v0009();
    let staged = StagedAppDir::from_fixture(fixture.name, fixture.seed_sql);
    {
        let mut connection =
            SqliteConnection::establish(staged.db_path().to_str().expect("utf8")).expect("seed");
        connection
            .batch_execute(
                "INSERT INTO recurring_occurrences (
                    recurring_transaction_id, schedule_revision_id, ordinal, scheduled_local,
                    template_revision_id, fulfilled_at, fulfillment_position, transaction_id,
                    fulfillment_kind
                 ) VALUES (
                    'rt-released-fixture', 'sched-released-fixture-1', 1, '2026-07-20 09:00:00',
                    'tmpl-released-fixture-1', '2026-07-20 09:00:00', 1, 'txn-recurring-fixture',
                    'adopted'
                 );",
            )
            .expect("occurrence");
    }
    let pool = activate_currency_schema(&staged.db_path()).expect("upgrade with occurrence");
    drop(pool);
    let mut connection =
        SqliteConnection::establish(staged.db_path().to_str().expect("utf8")).expect("reopen");
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM recurring_occurrences \
             WHERE transaction_id = 'txn-recurring-fixture'"
        ),
        1
    );
    assert_eq!(
        text_values(
            &mut connection,
            "SELECT currency AS value FROM transactions WHERE id = 'txn-recurring-fixture'"
        ),
        vec!["EUR".to_string()]
    );
}

#[test]
fn migration_failure_after_backup_keeps_backup_and_refuses_open() {
    let fixture = v0009();
    let staged = StagedAppDir::from_fixture(fixture.name, fixture.seed_sql);
    failpoints::arm(CurrencyMigrationFailpoint::AfterBackupBeforeMigrate);

    let error = match connect_with_client_format(staged.path(), ClientFormat::MultiCurrencyV1) {
        Ok(_) => panic!("injected failure must refuse open"),
        Err(error) => error,
    };
    failpoints::reset();

    assert!(matches!(error, Error::Database(_)));
    assert!(pre_currency_backup_path(&staged.db_path()).exists());
    let mut connection = reopen(&staged.db_path());
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM sqlite_master \
             WHERE type = 'table' AND name = 'application_format'"
        ),
        0,
        "failed activation must not leave format table"
    );
}

#[test]
fn migration_failure_after_migrate_restores_backup_and_refuses_open() {
    let fixture = v0009();
    let staged = StagedAppDir::from_fixture(fixture.name, fixture.seed_sql);
    failpoints::arm(CurrencyMigrationFailpoint::AfterMigrateBeforeOpen);

    let error = refuse_open(
        connect_with_client_format(staged.path(), ClientFormat::MultiCurrencyV1),
        "injected failure must refuse open",
    );
    failpoints::reset();

    assert!(matches!(error, Error::Database(_)));
    assert!(pre_currency_backup_path(&staged.db_path()).exists());
    let mut connection = reopen(&staged.db_path());
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM sqlite_master \
             WHERE type = 'table' AND name = 'application_format'"
        ),
        0,
        "rollback must restore pre-currency schema"
    );
}

#[test]
fn destructive_down_migration_is_refused_after_activation() {
    let temp_db = TempDb::new();
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");
    connection
        .run_pending_migrations(TEST_MIGRATIONS)
        .expect("migrate");

    let mut refused = connection.revert_last_migration(TEST_MIGRATIONS);
    while refused.is_ok() {
        refused = connection.revert_last_migration(TEST_MIGRATIONS);
    }
    assert!(refused.is_err(), "down after activation must refuse");
    assert_eq!(
        count(
            &mut connection,
            "SELECT COUNT(*) AS count FROM application_format"
        ),
        1
    );
}

#[tokio::test]
async fn pre_currency_client_fails_closed_on_migrated_database() {
    let fixture = v0009();
    let staged = StagedAppDir::from_fixture(fixture.name, fixture.seed_sql);
    let pool = activate_currency_schema(&staged.db_path()).expect("migrate");
    drop(pool);

    let error = refuse_open(
        open_existing_with_client_format(staged.path(), ClientFormat::PreCurrency),
        "old client must fail closed",
    );
    assert_eq!(error.code(), ErrorCode::IncompatibleApplicationFormat);
}

#[tokio::test]
async fn amount_only_write_persists_default_currency_identity_money() {
    let dir = std::env::temp_dir().join(format!("zai-identity-{}", Uuid::new_v4()));
    fs::create_dir_all(&dir).expect("dir");
    let database = crate::connect(&dir).expect("connect");
    database
        .currency_settings_repository()
        .complete_initial_setup("EUR")
        .expect("setup");
    let created = database
        .transactions_repository()
        .create_transaction(zai_core::features::transactions::models::NewTransaction {
            id: Some("txn-identity".to_string()),
            description: Some("Identity write".to_string()),
            amount: 2500,
            currency: "EUR".to_string(),
            transaction_date: crate::test_utils::fixed_local(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
            manual_exchange_rate: None,
        })
        .await
        .expect("create");
    assert_eq!(created.amount, 2500);
    let listed = database
        .transactions_repository()
        .get_transaction("txn-identity")
        .await
        .expect("read back");
    assert_eq!(listed.amount, 2500);
    drop(database);
    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn half_migrated_database_is_refused_by_current_client() {
    let fixture = v0009();
    let staged = StagedAppDir::from_fixture(fixture.name, fixture.seed_sql);
    let pool = activate_currency_schema(&staged.db_path()).expect("migrate");
    drop(pool);
    let mut connection =
        SqliteConnection::establish(staged.db_path().to_str().expect("utf8")).expect("open");
    connection
        .batch_execute("DELETE FROM application_format")
        .expect("strip format");

    let error = refuse_open(
        open_existing_with_client_format(staged.path(), ClientFormat::MultiCurrencyV1),
        "missing format is half-migrated",
    );
    assert!(matches!(error, Error::Database(_)));
}
