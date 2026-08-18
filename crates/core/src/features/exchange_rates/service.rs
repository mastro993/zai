use std::sync::Arc;
use std::time::Instant;

use chrono::{DateTime, Utc};
use tokio::sync::Mutex;
use uuid::Uuid;

use super::payload::{
    AcceptedObservation, AcceptedRateSet, FailureClass, parse_ecb_csv, validate_complete_set,
};
use super::ports::{
    ExchangeRateCache, ExchangeRateProvider, ProviderFetchResult, SyncMetadata, UtcClock,
};
use super::request::{ProviderRequest, build_initial_requests, build_refresh_request};
use crate::money::CurrencyCode;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RefreshOutcome {
    Published {
        elapsed_ms: u64,
        class: Option<FailureClass>,
    },
    NotModified {
        elapsed_ms: u64,
    },
    Failed {
        class: FailureClass,
        elapsed_ms: u64,
    },
}

impl RefreshOutcome {
    pub fn log_line(&self) -> String {
        match self {
            Self::Published { elapsed_ms, .. } => {
                format!("provider_refresh class=published elapsed_ms={elapsed_ms}")
            }
            Self::NotModified { elapsed_ms } => {
                format!("provider_refresh class=notModified elapsed_ms={elapsed_ms}")
            }
            Self::Failed { class, elapsed_ms } => {
                format!(
                    "provider_refresh class={} elapsed_ms={elapsed_ms}",
                    class.as_str()
                )
            }
        }
    }
}

pub struct SystemUtcClock;

impl UtcClock for SystemUtcClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

pub struct ExchangeRateService {
    provider: Arc<dyn ExchangeRateProvider>,
    cache: Arc<dyn ExchangeRateCache>,
    clock: Arc<dyn UtcClock>,
    inflight: Mutex<()>,
}

impl ExchangeRateService {
    pub fn new(
        provider: Arc<dyn ExchangeRateProvider>,
        cache: Arc<dyn ExchangeRateCache>,
        clock: Arc<dyn UtcClock>,
    ) -> Self {
        Self {
            provider,
            cache,
            clock,
            inflight: Mutex::new(()),
        }
    }

    pub async fn current_set(&self) -> crate::Result<Option<AcceptedRateSet>> {
        self.cache.current_set().await
    }

    pub async fn observation(
        &self,
        currency: CurrencyCode,
        value_date: chrono::NaiveDate,
    ) -> crate::Result<Option<AcceptedObservation>> {
        self.cache.observation(currency, value_date).await
    }

    pub async fn refresh(&self) -> RefreshOutcome {
        let _guard = self.inflight.lock().await;
        let started = Instant::now();
        let now = self.clock.now();
        let outcome = self.refresh_locked(now).await;
        let elapsed_ms = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
        with_elapsed(outcome, elapsed_ms)
    }

    async fn refresh_locked(&self, now: DateTime<Utc>) -> RefreshOutcome {
        let previous = match self.cache.current_set().await {
            Ok(value) => value,
            Err(_) => return failed(FailureClass::Internal, 0),
        };
        let metadata = match self.cache.sync_metadata().await {
            Ok(value) => value,
            Err(_) => return failed(FailureClass::Internal, 0),
        };
        let requests = if previous.is_none() {
            build_initial_requests(now)
        } else {
            vec![build_refresh_request(&metadata)]
        };
        let mut parsed = Vec::new();
        let mut next_metadata = metadata;
        for request in requests {
            match self.fetch_one(&request, &mut next_metadata, now).await {
                FetchStep::Continue(chunk) => parsed.extend(chunk),
                FetchStep::NotModified if previous.is_some() && parsed.is_empty() => {
                    return RefreshOutcome::NotModified { elapsed_ms: 0 };
                }
                FetchStep::NotModified => {}
                FetchStep::Failed(class) => {
                    return self.persist_failure(class, now).await;
                }
            }
        }
        if parsed.is_empty() && previous.is_some() {
            return RefreshOutcome::NotModified { elapsed_ms: 0 };
        }
        match validate_complete_set(&parsed, previous.as_ref(), Uuid::new_v4().to_string()) {
            Ok(set)
                if previous
                    .as_ref()
                    .is_some_and(|current| current.payload_digest == set.payload_digest) =>
            {
                RefreshOutcome::NotModified { elapsed_ms: 0 }
            }
            Ok(set) => match self.cache.publish(set, next_metadata, now).await {
                Ok(()) => RefreshOutcome::Published {
                    elapsed_ms: 0,
                    class: None,
                },
                Err(_) => self.persist_failure(FailureClass::Internal, now).await,
            },
            Err(class) => self.persist_failure(class, now).await,
        }
    }

    async fn persist_failure(&self, class: FailureClass, now: DateTime<Utc>) -> RefreshOutcome {
        match self.cache.record_failure(class, now).await {
            Ok(()) => failed(class, 0),
            Err(_) => failed(FailureClass::Internal, 0),
        }
    }

    async fn fetch_one(
        &self,
        request: &ProviderRequest,
        metadata: &mut SyncMetadata,
        now: DateTime<Utc>,
    ) -> FetchStep {
        match self.provider.fetch(request).await {
            ProviderFetchResult::NotModified => FetchStep::NotModified,
            ProviderFetchResult::Failed(class) => FetchStep::Failed(class),
            ProviderFetchResult::Payload(payload) => match parse_ecb_csv(&payload.body) {
                Ok(chunk) => {
                    if let Some(etag) = payload.etag {
                        metadata.etag = Some(etag);
                    }
                    metadata.updated_after = Some(now.to_rfc3339());
                    FetchStep::Continue(chunk)
                }
                Err(class) => FetchStep::Failed(class),
            },
        }
    }
}

enum FetchStep {
    Continue(Vec<super::payload::ParsedObservation>),
    NotModified,
    Failed(FailureClass),
}

fn failed(class: FailureClass, elapsed_ms: u64) -> RefreshOutcome {
    RefreshOutcome::Failed { class, elapsed_ms }
}

fn with_elapsed(outcome: RefreshOutcome, elapsed_ms: u64) -> RefreshOutcome {
    match outcome {
        RefreshOutcome::Published { class, .. } => RefreshOutcome::Published { elapsed_ms, class },
        RefreshOutcome::NotModified { .. } => RefreshOutcome::NotModified { elapsed_ms },
        RefreshOutcome::Failed { class, .. } => RefreshOutcome::Failed { class, elapsed_ms },
    }
}
