use super::CodeMigrationStore;
use crate::errors::StorageError;
use diesel::Connection;
use diesel::sqlite::SqliteConnection;
use log::error;
use zai_core::{DatabaseError, Error, Result};

pub trait CodeMigration: Send + Sync {
    fn version(&self) -> u32;
    fn name(&self) -> &'static str;
    fn up(&self, conn: &mut SqliteConnection) -> Result<()>;
}

pub fn run_pending_code_migrations(
    conn: &mut SqliteConnection,
    migrations: &[&dyn CodeMigration],
    store: &dyn CodeMigrationStore,
) -> Result<()> {
    let mut ordered: Vec<&dyn CodeMigration> = migrations.to_vec();
    ordered.sort_by_key(|migration| migration.version());

    let mut current = store.current_version(conn)?;
    for migration in ordered {
        let version = migration.version();
        if version <= current {
            continue;
        }

        let name = migration.name();
        let result: std::result::Result<(), StorageError> = conn.transaction(|conn| {
            migration.up(conn).map_err(StorageError::from)?;
            store
                .set_version(conn, version)
                .map_err(StorageError::from)?;
            Ok(())
        });

        if let Err(_err) = result {
            error!("Code migration {name} (v{version}) failed");
            return Err(Error::Database(DatabaseError::MigrationFailed(format!(
                "Code migration {name} failed"
            ))));
        }
        current = version;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::code_migrations::PragmaUserVersionStore;
    use diesel::connection::SimpleConnection;
    use diesel::prelude::*;
    use diesel::sql_query;
    use diesel::sql_types::Integer;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, Ordering};

    #[derive(Debug, QueryableByName)]
    struct CountRow {
        #[diesel(sql_type = Integer)]
        value: i32,
    }

    struct CreateMarkerMigration {
        version: u32,
        name: &'static str,
        fail: Arc<AtomicBool>,
        canary: &'static str,
    }

    impl CodeMigration for CreateMarkerMigration {
        fn version(&self) -> u32 {
            self.version
        }

        fn name(&self) -> &'static str {
            self.name
        }

        fn up(&self, conn: &mut SqliteConnection) -> Result<()> {
            conn.batch_execute(
                "CREATE TABLE IF NOT EXISTS code_migration_marker (id INTEGER PRIMARY KEY, note TEXT NOT NULL);",
            )
            .map_err(|err| Error::Database(DatabaseError::QueryFailed(err.to_string())))?;
            conn.batch_execute(&format!(
                "INSERT INTO code_migration_marker (note) VALUES ('{}');",
                self.canary
            ))
            .map_err(|err| Error::Database(DatabaseError::QueryFailed(err.to_string())))?;
            if self.fail.load(Ordering::SeqCst) {
                return Err(Error::Database(DatabaseError::QueryFailed(format!(
                    "boom containing {}",
                    self.canary
                ))));
            }
            Ok(())
        }
    }

    fn connect_memory() -> SqliteConnection {
        SqliteConnection::establish(":memory:").expect("memory sqlite")
    }

    fn marker_count(conn: &mut SqliteConnection) -> i32 {
        let row: CountRow = sql_query("SELECT COUNT(*) AS value FROM code_migration_marker")
            .get_result(conn)
            .unwrap_or(CountRow { value: 0 });
        row.value
    }

    #[test]
    fn runs_versioned_operation_in_one_transaction() {
        let mut conn = connect_memory();
        let store = PragmaUserVersionStore;
        let fail = Arc::new(AtomicBool::new(false));
        let migration = CreateMarkerMigration {
            version: 1,
            name: "marker_v1",
            fail: Arc::clone(&fail),
            canary: "ok",
        };

        run_pending_code_migrations(&mut conn, &[&migration], &store).expect("migration");
        assert_eq!(store.current_version(&mut conn).expect("version"), 1);
        assert_eq!(marker_count(&mut conn), 1);

        run_pending_code_migrations(&mut conn, &[&migration], &store).expect("idempotent");
        assert_eq!(store.current_version(&mut conn).expect("version"), 1);
        assert_eq!(marker_count(&mut conn), 1);
    }

    #[test]
    fn failed_migration_rolls_back_and_surfaces_privacy_safe_error() {
        let mut conn = connect_memory();
        let store = PragmaUserVersionStore;
        let canary = "AMOUNT_99999_SECRET_LEDGER";
        let fail = Arc::new(AtomicBool::new(true));
        let migration = CreateMarkerMigration {
            version: 1,
            name: "marker_v1",
            fail,
            canary,
        };

        let err = run_pending_code_migrations(&mut conn, &[&migration], &store)
            .expect_err("migration must fail");

        assert_eq!(store.current_version(&mut conn).expect("version"), 0);
        let table_exists: CountRow = sql_query(
            "SELECT COUNT(*) AS value FROM sqlite_master WHERE type = 'table' AND name = 'code_migration_marker'",
        )
        .get_result(&mut conn)
        .expect("sqlite_master");
        assert_eq!(table_exists.value, 0);

        let envelope = err.to_envelope("Upgrade failed");
        assert_eq!(envelope.code, zai_core::ErrorCode::Internal);
        assert!(!envelope.message.contains(canary));
        assert!(envelope.message.contains("An internal error occurred"));
    }
}
