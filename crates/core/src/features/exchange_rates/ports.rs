use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, Utc};

use super::payload::{AcceptedObservation, AcceptedRateSet, FailureClass, ProviderPayload};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyncMetadata {
    pub updated_after: Option<String>,
    pub etag: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProviderFetchResult {
    Payload(ProviderPayload),
    NotModified,
    Failed(FailureClass),
}

#[async_trait]
pub trait ExchangeRateProvider: Send + Sync {
    async fn fetch(&self, request: &super::ProviderRequest) -> ProviderFetchResult;
}

pub trait UtcClock: Send + Sync {
    fn now(&self) -> DateTime<Utc>;
}

#[async_trait]
pub trait ExchangeRateCache: Send + Sync {
    async fn current_set(&self) -> crate::Result<Option<AcceptedRateSet>>;
    async fn sync_metadata(&self) -> crate::Result<SyncMetadata>;
    async fn publish(
        &self,
        set: AcceptedRateSet,
        metadata: SyncMetadata,
        attempted_at: DateTime<Utc>,
    ) -> crate::Result<()>;
    async fn record_failure(
        &self,
        class: FailureClass,
        attempted_at: DateTime<Utc>,
    ) -> crate::Result<()>;
    async fn observation(
        &self,
        currency: crate::money::CurrencyCode,
        value_date: NaiveDate,
    ) -> crate::Result<Option<AcceptedObservation>>;
}
