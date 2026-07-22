use super::queries_projection::{load_projection_compute_input, read_schema_version};
use super::repository::RecurringTransactionsRepository;
use crate::blocking::run_blocking;
use crate::connection::get_connection;
use chrono::NaiveDateTime;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::recurring_transactions::projection::ProjectionComputeInput;

impl RecurringTransactionsRepository {
    pub(crate) async fn read_current_schema_version(&self) -> Result<String> {
        let pool = Arc::clone(&self.pool);
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            read_schema_version(&mut conn)
        })
        .await
    }

    pub(crate) async fn load_projection_compute_input(
        &self,
        observed_local: NaiveDateTime,
        horizon_months: u32,
        include_paused_budgets: bool,
        focus_recurring_transaction_id: Option<String>,
    ) -> Result<ProjectionComputeInput> {
        let pool = Arc::clone(&self.pool);
        run_blocking(move || {
            let mut conn = get_connection(&pool)?;
            load_projection_compute_input(
                &mut conn,
                observed_local,
                horizon_months,
                include_paused_budgets,
                focus_recurring_transaction_id,
            )
        })
        .await
    }
}
