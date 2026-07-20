mod convert;
mod ddl;

use super::CodeMigration;
use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::time::DeviceZoneProvider;
use zai_core::{DatabaseError, Error, Result};

pub struct RecurringMvpSchemaMigration {
    zone_provider: Arc<dyn DeviceZoneProvider>,
}

impl RecurringMvpSchemaMigration {
    pub fn new(zone_provider: Arc<dyn DeviceZoneProvider>) -> Self {
        Self { zone_provider }
    }
}

impl CodeMigration for RecurringMvpSchemaMigration {
    fn version(&self) -> u32 {
        1
    }

    fn name(&self) -> &'static str {
        "recurring_mvp_schema"
    }

    fn up(&self, conn: &mut SqliteConnection) -> Result<()> {
        let zone = self.zone_provider.current_zone()?;

        conn.batch_execute(ddl::RENAME_LEGACY_TABLES)
            .map_err(convert::query_failed)?;
        conn.batch_execute(ddl::CREATE_REBUILT_TABLES)
            .map_err(convert::query_failed)?;

        convert::copy_transactions(conn, &zone)?;
        convert::copy_budgets(conn, &zone)?;
        convert::copy_budget_periods(conn)?;
        convert::copy_domain_alerts(conn)?;

        conn.batch_execute(ddl::DROP_LEGACY_TABLES)
            .map_err(convert::query_failed)?;
        conn.batch_execute(ddl::CREATE_REBUILT_INDEXES)
            .map_err(convert::query_failed)?;
        conn.batch_execute(ddl::CREATE_RECURRING_TABLES)
            .map_err(convert::query_failed)?;

        convert::run_integrity_checks(conn)
    }
}

const RECURRING_TABLES: &[&str] = &[
    "recurring_transactions",
    "recurring_schedule_revisions",
    "recurring_template_revisions",
    "recurring_occurrence_heads",
    "recurring_occurrences",
    "recurring_generation_failures",
];

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    count: i64,
}

/// Refuses downgrading (reverting/dropping the recurring schema) while any
/// recurring row exists. Code migrations have no `down`; this guard is the
/// explicit contract for tooling that would attempt a downgrade.
pub fn ensure_recurring_schema_downgrade_allowed(conn: &mut SqliteConnection) -> Result<()> {
    for table in RECURRING_TABLES {
        let row: CountRow = sql_query(format!("SELECT COUNT(*) AS count FROM {table}"))
            .get_result(conn)
            .map_err(convert::query_failed)?;
        if row.count > 0 {
            return Err(Error::Database(DatabaseError::MigrationFailed(format!(
                "Cannot downgrade recurring schema: {table} still contains data"
            ))));
        }
    }
    Ok(())
}
