mod cache;
mod generation;
mod spending;

#[cfg(test)]
mod explain_tests;
#[cfg(test)]
mod repository_tests;

pub(crate) use cache::upsert_transaction_valuation;
#[cfg(test)]
pub(crate) use generation::INITIAL_ACTUAL_GENERATION_ID;
pub(crate) use generation::{
    activate_generation, active_generation, build_actual_generation, change_default_currency,
    current_allowance_currency,
};
pub(crate) use spending::{SpendingAggregate, sum_period_spending};

use crate::connection::{DbPool, get_connection};
use crate::write_actor::WriteHandle;
use chrono::NaiveDateTime;
use std::sync::Arc;
use zai_core::Result;
use zai_core::money::CurrencyCode;

pub struct ValuationsRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
}

impl ValuationsRepository {
    pub(crate) fn new(pool: Arc<DbPool>, writer: WriteHandle) -> Self {
        Self { pool, writer }
    }

    pub async fn active_actual(&self) -> Result<ActiveGeneration> {
        let mut connection = get_connection(&self.pool)?;
        active_generation(&mut connection)
    }

    pub async fn change_default_currency(
        &self,
        target: CurrencyCode,
        now: NaiveDateTime,
    ) -> Result<ActiveGeneration> {
        self.writer
            .exec(move |connection| {
                change_default_currency(connection, target, now)
                    .map_err(crate::errors::StorageError::from)
            })
            .await
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActiveGeneration {
    pub id: String,
    pub target_currency: String,
    pub revision: i32,
}
