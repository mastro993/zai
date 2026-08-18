use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use tokio::sync::watch;
use zai_core::features::currency::{
    CURRENCY_REFRESH_FAILURE_OCCURRENCE_KEY, CURRENCY_REFRESH_FAILURE_PRODUCER_KEY,
    CurrencyService, CurrencyStateEvent, CurrencyStateEventBus, CurrencyStateEventPublisher,
    build_refresh_failure_alert,
};
use zai_core::features::exchange_rates::{ExchangeRateService, RefreshOutcome};
use zai_db::domain_alerts::DomainAlertsRepository;

const REFRESH_INTERVAL: Duration = Duration::from_secs(15 * 60);

pub struct CurrencyRefreshSupervisor {
    exchange: Arc<ExchangeRateService>,
    currency: Arc<CurrencyService>,
    alerts: Arc<DomainAlertsRepository>,
    events: Arc<CurrencyStateEventBus>,
    wake: watch::Sender<()>,
    shutdown: watch::Sender<bool>,
}

#[derive(Clone)]
pub struct CurrencyRefreshHandle {
    wake: watch::Sender<()>,
    shutdown: watch::Sender<bool>,
}

impl CurrencyRefreshHandle {
    pub fn request_wake(&self) {
        let _ = self.wake.send(());
    }

    pub fn request_shutdown(&self) {
        let _ = self.shutdown.send(true);
    }
}

impl CurrencyRefreshSupervisor {
    pub fn new(
        exchange: Arc<ExchangeRateService>,
        currency: Arc<CurrencyService>,
        alerts: Arc<DomainAlertsRepository>,
        events: Arc<CurrencyStateEventBus>,
    ) -> Self {
        let (wake, _) = watch::channel(());
        let (shutdown, _) = watch::channel(false);
        Self {
            exchange,
            currency,
            alerts,
            events,
            wake,
            shutdown,
        }
    }

    pub fn handle(&self) -> CurrencyRefreshHandle {
        CurrencyRefreshHandle {
            wake: self.wake.clone(),
            shutdown: self.shutdown.clone(),
        }
    }

    pub fn spawn(self) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            self.run().await;
        })
    }

    async fn run(self) {
        let mut wake = self.wake.subscribe();
        let mut shutdown = self.shutdown.subscribe();
        let mut interval = tokio::time::interval(REFRESH_INTERVAL);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        self.tick().await;
        loop {
            tokio::select! {
                _ = interval.tick() => self.tick().await,
                changed = wake.changed() => {
                    if changed.is_err() {
                        break;
                    }
                    self.tick().await;
                }
                changed = shutdown.changed() => {
                    if changed.is_err() || *shutdown.borrow() {
                        break;
                    }
                }
            }
        }
    }

    async fn tick(&self) {
        let retained = self.currency.has_ecb_retained_data().unwrap_or(false);
        if !retained {
            return;
        }
        let outcome = self.exchange.refresh().await;
        let _ = apply_refresh_outcome(&self.currency, &self.alerts, &outcome).await;
        let _ =
            CurrencyStateEventPublisher::publish(&*self.events, &CurrencyStateEvent::StateChanged);
    }
}

pub async fn apply_refresh_outcome(
    currency: &CurrencyService,
    alerts: &DomainAlertsRepository,
    outcome: &RefreshOutcome,
) -> zai_core::Result<()> {
    let now = Utc::now();
    match outcome {
        RefreshOutcome::Failed { .. } => {
            let rows = currency.list_settings()?;
            let affected: Vec<String> = rows
                .into_iter()
                .filter(|row| {
                    row.status == zai_core::features::currency::CurrencyLifecycleStatus::Enabled
                        && row.code != "EUR"
                        && (row.refresh_status
                            == zai_core::features::currency::CurrencyRefreshStatus::Failed
                            || !row.missing_periods.is_empty())
                })
                .map(|row| row.code)
                .collect();
            if affected.is_empty() {
                return Ok(());
            }
            let alert = build_refresh_failure_alert(now, now, &affected)?;
            let _ = alerts.ensure_open(alert).await?;
        }
        RefreshOutcome::Published { .. } | RefreshOutcome::NotModified { .. } => {
            let _ = alerts
                .resolve_by_keys(
                    CURRENCY_REFRESH_FAILURE_PRODUCER_KEY,
                    CURRENCY_REFRESH_FAILURE_OCCURRENCE_KEY,
                )
                .await?;
        }
    }
    Ok(())
}
