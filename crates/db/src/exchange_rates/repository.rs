use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Integer, Nullable, Text, Timestamp};
use uuid::Uuid;
use zai_core::Result;
use zai_core::features::exchange_rates::{
    AcceptedObservation, AcceptedRateSet, ExchangeRateCache, FailureClass, PROVIDER_CONTRACT_ID,
    SyncMetadata,
};
use zai_core::money::{CanonicalRate, CurrencyCode};

use crate::connection::{DbPool, get_connection};
use crate::errors::{IntoCore, IntoStorage};
use crate::write_actor::WriteHandle;

#[derive(QueryableByName)]
struct HeadIdRow {
    #[diesel(sql_type = Text)]
    id: String,
    #[diesel(sql_type = Text)]
    revision_identity: String,
    #[diesel(sql_type = Text)]
    payload_digest: String,
}

#[derive(QueryableByName)]
struct ObservationRow {
    #[diesel(sql_type = Text)]
    currency: String,
    #[diesel(sql_type = Text)]
    series_id: String,
    #[diesel(sql_type = Text)]
    value_date: String,
    #[diesel(sql_type = Text)]
    original_decimal: String,
    #[diesel(sql_type = Text)]
    attribution: String,
}

#[derive(QueryableByName)]
struct RefreshStateRow {
    #[diesel(sql_type = Nullable<Text>)]
    last_etag: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    last_updated_after: Option<String>,
}

pub struct ExchangeRateRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
}

impl ExchangeRateRepository {
    pub(crate) fn new(pool: Arc<DbPool>, writer: WriteHandle) -> Self {
        Self { pool, writer }
    }
}

#[async_trait]
impl ExchangeRateCache for ExchangeRateRepository {
    async fn current_set(&self) -> Result<Option<AcceptedRateSet>> {
        let mut connection = get_connection(&self.pool)?;
        load_current_set(&mut connection)
    }

    async fn sync_metadata(&self) -> Result<SyncMetadata> {
        let mut connection = get_connection(&self.pool)?;
        let row = sql_query(
            "SELECT last_etag, last_updated_after FROM provider_refresh_state WHERE id = 1",
        )
        .get_result::<RefreshStateRow>(&mut connection)
        .into_core()?;
        Ok(SyncMetadata {
            updated_after: row.last_updated_after,
            etag: row.last_etag,
        })
    }

    async fn publish(
        &self,
        set: AcceptedRateSet,
        metadata: SyncMetadata,
        attempted_at: DateTime<Utc>,
    ) -> Result<()> {
        self.writer
            .exec(move |connection| {
                publish_set(connection, set, metadata, attempted_at.naive_utc()).into_storage()
            })
            .await
    }

    async fn record_failure(&self, class: FailureClass, attempted_at: DateTime<Utc>) -> Result<()> {
        self.writer
            .exec(move |connection| {
                record_failure(connection, class, attempted_at.naive_utc()).into_storage()
            })
            .await
    }

    async fn observation(
        &self,
        currency: CurrencyCode,
        value_date: NaiveDate,
    ) -> Result<Option<AcceptedObservation>> {
        let mut connection = get_connection(&self.pool)?;
        load_observation(&mut connection, currency, value_date)
    }
}

fn load_current_set(connection: &mut SqliteConnection) -> Result<Option<AcceptedRateSet>> {
    let head = sql_query(
        "SELECT s.id, s.revision_identity, s.payload_digest \
         FROM provider_heads h \
         JOIN provider_rate_sets s ON s.id = h.rate_set_id \
         WHERE h.id = 1",
    )
    .get_result::<HeadIdRow>(connection)
    .optional()
    .into_core()?;
    let Some(head) = head else {
        return Ok(None);
    };
    let rows = sql_query(
        "SELECT currency, series_id, value_date, original_decimal, attribution \
         FROM provider_rate_observations \
         WHERE rate_set_id = ? \
         ORDER BY currency, value_date",
    )
    .bind::<Text, _>(&head.id)
    .load::<ObservationRow>(connection)
    .into_core()?;
    let mut observations = Vec::with_capacity(rows.len());
    for row in rows {
        observations.push(observation_from_row(row)?);
    }
    Ok(Some(AcceptedRateSet {
        id: head.id,
        revision_identity: head.revision_identity,
        payload_digest: head.payload_digest,
        observations,
    }))
}

fn load_observation(
    connection: &mut SqliteConnection,
    currency: CurrencyCode,
    value_date: NaiveDate,
) -> Result<Option<AcceptedObservation>> {
    let row = sql_query(
        "SELECT o.currency, o.series_id, o.value_date, o.original_decimal, o.attribution \
         FROM provider_heads h \
         JOIN provider_rate_observations o ON o.rate_set_id = h.rate_set_id \
         WHERE h.id = 1 AND o.currency = ? AND o.value_date = ?",
    )
    .bind::<Text, _>(currency.as_str())
    .bind::<Text, _>(value_date.to_string())
    .get_result::<ObservationRow>(connection)
    .optional()
    .into_core()?;
    row.map(observation_from_row).transpose()
}

fn observation_from_row(row: ObservationRow) -> Result<AcceptedObservation> {
    Ok(AcceptedObservation {
        currency: CurrencyCode::parse(&row.currency)?,
        series_id: row.series_id,
        value_date: NaiveDate::parse_from_str(&row.value_date, "%Y-%m-%d").map_err(|err| {
            zai_core::Error::InvalidData(format!("Invalid stored value date: {err}"))
        })?,
        rate: CanonicalRate::parse(&row.original_decimal)?,
        attribution: row.attribution,
    })
}

fn publish_set(
    connection: &mut SqliteConnection,
    set: AcceptedRateSet,
    metadata: SyncMetadata,
    now: NaiveDateTime,
) -> Result<()> {
    sql_query(
        "INSERT INTO provider_rate_sets (\
            id, provider_contract_id, revision_identity, payload_digest, accepted_at\
         ) VALUES (?, ?, ?, ?, ?)",
    )
    .bind::<Text, _>(&set.id)
    .bind::<Text, _>(PROVIDER_CONTRACT_ID)
    .bind::<Text, _>(&set.revision_identity)
    .bind::<Text, _>(&set.payload_digest)
    .bind::<Timestamp, _>(now)
    .execute(connection)
    .into_core()?;

    for observation in &set.observations {
        sql_query(
            "INSERT INTO provider_rate_observations (\
                id, rate_set_id, currency, series_id, value_date, \
                original_decimal, coefficient, scale, attribution\
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind::<Text, _>(format!("obs-{}", Uuid::new_v4()))
        .bind::<Text, _>(&set.id)
        .bind::<Text, _>(observation.currency.as_str())
        .bind::<Text, _>(&observation.series_id)
        .bind::<Text, _>(observation.value_date.to_string())
        .bind::<Text, _>(observation.rate.original_decimal())
        .bind::<BigInt, _>(observation.rate.coefficient())
        .bind::<Integer, _>(i32::try_from(observation.rate.scale()).map_err(|_| {
            zai_core::Error::InvalidData("Exchange rate scale exceeds i32".to_string())
        })?)
        .bind::<Text, _>(&observation.attribution)
        .execute(connection)
        .into_core()?;
    }

    sql_query(
        "INSERT INTO provider_heads (id, rate_set_id, switched_at) \
         VALUES (1, ?, ?) \
         ON CONFLICT(id) DO UPDATE SET rate_set_id = excluded.rate_set_id, \
         switched_at = excluded.switched_at",
    )
    .bind::<Text, _>(&set.id)
    .bind::<Timestamp, _>(now)
    .execute(connection)
    .into_core()?;

    sql_query(
        "UPDATE provider_refresh_state \
         SET last_attempt_at = ?, last_success_at = ?, failure_class = NULL, \
             retry_count = 0, last_etag = ?, last_updated_after = ? \
         WHERE id = 1",
    )
    .bind::<Timestamp, _>(now)
    .bind::<Timestamp, _>(now)
    .bind::<Nullable<Text>, _>(metadata.etag.as_deref())
    .bind::<Nullable<Text>, _>(metadata.updated_after.as_deref())
    .execute(connection)
    .into_core()?;
    Ok(())
}

fn record_failure(
    connection: &mut SqliteConnection,
    class: FailureClass,
    now: NaiveDateTime,
) -> Result<()> {
    sql_query(
        "UPDATE provider_refresh_state \
         SET last_attempt_at = ?, failure_class = ?, retry_count = retry_count + 1 \
         WHERE id = 1",
    )
    .bind::<Timestamp, _>(now)
    .bind::<Text, _>(class.as_str())
    .execute(connection)
    .into_core()?;
    Ok(())
}
