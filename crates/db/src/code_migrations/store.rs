use diesel::sqlite::SqliteConnection;
use diesel::{RunQueryDsl, sql_query};
use zai_core::{DatabaseError, Error, Result};

pub trait CodeMigrationStore: Send + Sync {
    fn current_version(&self, conn: &mut SqliteConnection) -> Result<u32>;
    fn set_version(&self, conn: &mut SqliteConnection, version: u32) -> Result<()>;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct PragmaUserVersionStore;

#[derive(Debug, diesel::QueryableByName)]
struct UserVersionRow {
    #[diesel(sql_type = diesel::sql_types::Integer)]
    user_version: i32,
}

impl CodeMigrationStore for PragmaUserVersionStore {
    fn current_version(&self, conn: &mut SqliteConnection) -> Result<u32> {
        let row: UserVersionRow = sql_query("PRAGMA user_version")
            .get_result(conn)
            .map_err(|err| Error::Database(DatabaseError::QueryFailed(err.to_string())))?;
        u32::try_from(row.user_version.max(0)).map_err(|_| {
            Error::Database(DatabaseError::Internal(
                "PRAGMA user_version out of range".into(),
            ))
        })
    }

    fn set_version(&self, conn: &mut SqliteConnection, version: u32) -> Result<()> {
        let version = i32::try_from(version).map_err(|_| {
            Error::Database(DatabaseError::Internal(
                "Code migration version out of range".into(),
            ))
        })?;
        sql_query(format!("PRAGMA user_version = {version}"))
            .execute(conn)
            .map_err(|err| Error::Database(DatabaseError::QueryFailed(err.to_string())))?;
        Ok(())
    }
}
