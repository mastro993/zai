use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, TimeZone, Utc};
use tokio::sync::Mutex;

use crate::money::CurrencyCode;

use super::contract::APPROVED_ECB_CURRENCIES;
use super::payload::{
    AcceptedObservation, AcceptedRateSet, FailureClass, ProviderPayload, parse_ecb_csv,
    validate_complete_set,
};
use super::ports::{
    ExchangeRateCache, ExchangeRateProvider, ProviderFetchResult, SyncMetadata, UtcClock,
};
use super::request::ProviderRequest;
use super::service::{ExchangeRateService, RefreshOutcome};

struct FixedClock;

impl UtcClock for FixedClock {
    fn now(&self) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 18, 12, 0, 0).unwrap()
    }
}

fn complete_csv() -> String {
    let mut body = String::from("CURRENCY,TIME_PERIOD,OBS_VALUE\n");
    for code in APPROVED_ECB_CURRENCIES {
        body.push_str(&format!("{code},2026-08-17,1.25\n"));
    }
    body
}

struct RecordingProvider {
    inflight: AtomicUsize,
    max_inflight: AtomicUsize,
    calls: AtomicUsize,
    result: Mutex<ProviderFetchResult>,
}

impl RecordingProvider {
    fn payload() -> Self {
        Self {
            inflight: AtomicUsize::new(0),
            max_inflight: AtomicUsize::new(0),
            calls: AtomicUsize::new(0),
            result: Mutex::new(ProviderFetchResult::Payload(ProviderPayload {
                body: complete_csv(),
                etag: Some("etag-1".to_string()),
                last_modified: Some("2026-08-17T16:00:00+02:00".to_string()),
            })),
        }
    }

    fn failing(class: FailureClass) -> Self {
        let provider = Self::payload();
        *provider.result.try_lock().expect("result") = ProviderFetchResult::Failed(class);
        provider
    }
}

#[async_trait]
impl ExchangeRateProvider for RecordingProvider {
    async fn fetch(&self, request: &ProviderRequest) -> ProviderFetchResult {
        assert_eq!(request.host, "data-api.ecb.europa.eu");
        assert!(request.url().starts_with("https://data-api.ecb.europa.eu/"));
        let current = self.inflight.fetch_add(1, Ordering::SeqCst) + 1;
        self.max_inflight.fetch_max(current, Ordering::SeqCst);
        self.calls.fetch_add(1, Ordering::SeqCst);
        tokio::time::sleep(Duration::from_millis(5)).await;
        self.inflight.fetch_sub(1, Ordering::SeqCst);
        self.result.lock().await.clone()
    }
}

struct MemoryCache {
    set: Mutex<Option<AcceptedRateSet>>,
    metadata: Mutex<SyncMetadata>,
    failures: Mutex<Vec<FailureClass>>,
}

impl MemoryCache {
    fn empty() -> Self {
        Self {
            set: Mutex::new(None),
            metadata: Mutex::new(SyncMetadata {
                updated_after: None,
                etag: None,
            }),
            failures: Mutex::new(Vec::new()),
        }
    }

    fn seeded() -> Self {
        let parsed = parse_ecb_csv(&complete_csv()).expect("parse");
        let set = validate_complete_set(&parsed, None, "seed".to_string()).expect("set");
        Self {
            set: Mutex::new(Some(set)),
            metadata: Mutex::new(SyncMetadata {
                updated_after: Some("2026-08-17T16:00:00+02:00".to_string()),
                etag: Some("etag-0".to_string()),
            }),
            failures: Mutex::new(Vec::new()),
        }
    }
}

#[async_trait]
impl ExchangeRateCache for MemoryCache {
    async fn current_set(&self) -> crate::Result<Option<AcceptedRateSet>> {
        Ok(self.set.lock().await.clone())
    }

    async fn sync_metadata(&self) -> crate::Result<SyncMetadata> {
        Ok(self.metadata.lock().await.clone())
    }

    async fn publish(
        &self,
        set: AcceptedRateSet,
        metadata: SyncMetadata,
        _attempted_at: DateTime<Utc>,
    ) -> crate::Result<()> {
        *self.set.lock().await = Some(set);
        *self.metadata.lock().await = metadata;
        Ok(())
    }

    async fn record_failure(
        &self,
        class: FailureClass,
        _attempted_at: DateTime<Utc>,
    ) -> crate::Result<()> {
        self.failures.lock().await.push(class);
        Ok(())
    }

    async fn observation(
        &self,
        currency: CurrencyCode,
        value_date: NaiveDate,
    ) -> crate::Result<Option<AcceptedObservation>> {
        Ok(self.set.lock().await.as_ref().and_then(|set| {
            set.observations
                .iter()
                .find(|observation| {
                    observation.currency == currency && observation.value_date == value_date
                })
                .cloned()
        }))
    }
}

#[tokio::test]
async fn initial_refresh_publishes_complete_set_from_cache_first_reads() {
    let cache = Arc::new(MemoryCache::empty());
    let provider = Arc::new(RecordingProvider::payload());
    let service = ExchangeRateService::new(provider, cache.clone(), Arc::new(FixedClock));
    assert!(service.current_set().await.unwrap().is_none());
    let outcome = service.refresh().await;
    assert!(matches!(outcome, RefreshOutcome::Published { .. }));
    assert!(!outcome.log_line().contains("1.25"));
    let set = service.current_set().await.unwrap().expect("published");
    assert_eq!(set.observations.len(), APPROVED_ECB_CURRENCIES.len());
}

#[tokio::test]
async fn identical_payload_is_not_modified() {
    let cache = Arc::new(MemoryCache::seeded());
    let provider = Arc::new(RecordingProvider::payload());
    let service = ExchangeRateService::new(provider, cache.clone(), Arc::new(FixedClock));
    let before = cache.current_set().await.unwrap().expect("seed");
    let outcome = service.refresh().await;
    assert!(matches!(outcome, RefreshOutcome::NotModified { .. }));
    let after = cache.current_set().await.unwrap().expect("kept");
    assert_eq!(after.id, before.id);
}

#[tokio::test]
async fn failed_refresh_keeps_last_known_good_head() {
    let cache = Arc::new(MemoryCache::seeded());
    let before = cache.current_set().await.unwrap().expect("seed");
    let provider = Arc::new(RecordingProvider::failing(FailureClass::Transport));
    let service = ExchangeRateService::new(provider, cache.clone(), Arc::new(FixedClock));
    let outcome = service.refresh().await;
    assert!(matches!(
        outcome,
        RefreshOutcome::Failed {
            class: FailureClass::Transport,
            ..
        }
    ));
    assert!(
        outcome
            .log_line()
            .starts_with("provider_refresh class=transport elapsed_ms=")
    );
    let after = cache.current_set().await.unwrap().expect("kept");
    assert_eq!(after.id, before.id);
    assert_eq!(after.payload_digest, before.payload_digest);
}

#[tokio::test]
async fn one_provider_request_in_flight_at_a_time() {
    let cache = Arc::new(MemoryCache::seeded());
    let provider = Arc::new(RecordingProvider::payload());
    let service = Arc::new(ExchangeRateService::new(
        provider.clone(),
        cache,
        Arc::new(FixedClock),
    ));
    let first = {
        let service = service.clone();
        tokio::spawn(async move { service.refresh().await })
    };
    let second = {
        let service = service.clone();
        tokio::spawn(async move { service.refresh().await })
    };
    let _ = tokio::join!(first, second);
    assert_eq!(provider.max_inflight.load(Ordering::SeqCst), 1);
}
