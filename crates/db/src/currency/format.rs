use crate::connection::{DbPool, get_connection};
use crate::errors::IntoCore;
use diesel::prelude::QueryableByName;
use diesel::sql_query;
use diesel::{RunQueryDsl, sqlite::SqliteConnection};
use zai_core::{DatabaseError, Error, Result};

pub const APPLICATION_FORMAT_V1: &str = "multi-currency-v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClientFormat {
    PreCurrency,
    MultiCurrencyV1,
}

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    count: i64,
}

pub fn application_format_present(connection: &mut SqliteConnection) -> Result<bool> {
    let table_count = sql_query(
        "SELECT COUNT(*) AS count FROM sqlite_master \
         WHERE type = 'table' AND name = 'application_format'",
    )
    .get_result::<CountRow>(connection)
    .into_core()?
    .count;
    if table_count == 0 {
        return Ok(false);
    }
    let format_count = sql_query(
        "SELECT COUNT(*) AS count FROM application_format \
         WHERE format = 'multi-currency-v1'",
    )
    .get_result::<CountRow>(connection)
    .into_core()?
    .count;
    Ok(format_count > 0)
}

pub fn assert_client_format(pool: &DbPool, client: ClientFormat) -> Result<()> {
    let mut connection = get_connection(pool)?;
    let present = application_format_present(&mut connection)?;
    match client {
        ClientFormat::PreCurrency if present => Err(Error::IncompatibleApplicationFormat),
        ClientFormat::MultiCurrencyV1 if !present => {
            Err(Error::Database(DatabaseError::MigrationFailed(
                "half-migrated or pre-currency database refused".to_string(),
            )))
        }
        _ => Ok(()),
    }
}
