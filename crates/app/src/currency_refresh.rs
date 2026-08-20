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
        let _ =
            run_provider_refresh(&self.exchange, &self.currency, &self.alerts, &*self.events).await;
    }
}

pub async fn refresh_reporting_progress(
    exchange: &ExchangeRateService,
    events: &dyn CurrencyStateEventPublisher,
) -> RefreshOutcome {
    exchange
        .refresh_with_progress(|current, total| {
            let _ = events.publish(&CurrencyStateEvent::RefreshProgress { current, total });
        })
        .await
}

pub async fn run_provider_refresh(
    exchange: &ExchangeRateService,
    currency: &CurrencyService,
    alerts: &DomainAlertsRepository,
    events: &dyn CurrencyStateEventPublisher,
) -> RefreshOutcome {
    let outcome = refresh_reporting_progress(exchange, events).await;
    let _ = apply_refresh_outcome(currency, alerts, &outcome).await;
    let _ = events.publish(&CurrencyStateEvent::StateChanged);
    outcome
}

pub async fn apply_refresh_outcome(
    currency: &CurrencyService,
    alerts: &DomainAlertsRepository,
    outcome: &RefreshOutcome,
) -> zai_core::Result<()> {
    log::info!("{}", outcome.log_line());
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

#[cfg(test)]
mod tests {
    use super::apply_refresh_outcome;
    use crate::initialize_context;
    use diesel::prelude::*;
    use diesel::sql_query;
    use diesel::sqlite::SqliteConnection;
    use std::{
        env, fs,
        path::{Path, PathBuf},
    };
    use uuid::Uuid;
    use zai_core::features::currency::CURRENCY_REFRESH_FAILURE_PRODUCER_KEY;
    use zai_core::features::domain_alerts::{DomainAlertsServiceTrait, ListDomainAlertsQuery};
    use zai_core::features::exchange_rates::{FailureClass, RefreshOutcome};

    struct TempAppDataDir {
        path: PathBuf,
    }

    impl TempAppDataDir {
        fn new() -> Self {
            Self {
                path: env::temp_dir().join(format!("zai-app-refresh-{}", Uuid::new_v4())),
            }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TempAppDataDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn mark_provider_refresh_failed(db_path: &Path) {
        let mut connection =
            SqliteConnection::establish(db_path.to_string_lossy().as_ref()).expect("open sqlite");
        sql_query(
            "UPDATE provider_refresh_state \
             SET last_attempt_at = datetime('now'), failure_class = 'httpStatus', retry_count = 2 \
             WHERE id = 1",
        )
        .execute(&mut connection)
        .expect("mark refresh failed");
    }

    async fn open_refresh_alerts(service: &dyn DomainAlertsServiceTrait) -> usize {
        let page = service
            .list_alerts(ListDomainAlertsQuery {
                cursor: None,
                limit: None,
                read_state: None,
                severities: None,
            })
            .await
            .expect("list alerts");
        page.items
            .into_iter()
            .filter(|alert| {
                alert.producer_key == CURRENCY_REFRESH_FAILURE_PRODUCER_KEY
                    && alert.resolved_at.is_none()
            })
            .count()
    }

    #[tokio::test]
    async fn apply_refresh_outcome_creates_one_alert_and_resolves_on_success() {
        let app_data_dir = TempAppDataDir::new();
        let context = initialize_context(app_data_dir.path()).expect("context");
        context
            .currency_service()
            .complete_initial_setup("EUR")
            .expect("confirm EUR");
        context
            .currency_service()
            .start_currency_addition("RUB", false)
            .expect("start RUB");
        context
            .currency_service()
            .drive_running_job()
            .expect("enable RUB");

        mark_provider_refresh_failed(&app_data_dir.path().join("zai.db"));

        apply_refresh_outcome(
            context.currency_service().as_ref(),
            context.domain_alerts_repository.as_ref(),
            &RefreshOutcome::Failed {
                class: FailureClass::HttpStatus,
                elapsed_ms: 12,
            },
        )
        .await
        .expect("first fail");
        assert_eq!(
            open_refresh_alerts(context.domain_alerts_service().as_ref()).await,
            1
        );

        apply_refresh_outcome(
            context.currency_service().as_ref(),
            context.domain_alerts_repository.as_ref(),
            &RefreshOutcome::Failed {
                class: FailureClass::HttpStatus,
                elapsed_ms: 18,
            },
        )
        .await
        .expect("second fail");
        assert_eq!(
            open_refresh_alerts(context.domain_alerts_service().as_ref()).await,
            1
        );

        apply_refresh_outcome(
            context.currency_service().as_ref(),
            context.domain_alerts_repository.as_ref(),
            &RefreshOutcome::NotModified { elapsed_ms: 4 },
        )
        .await
        .expect("resolve");
        assert_eq!(
            open_refresh_alerts(context.domain_alerts_service().as_ref()).await,
            0
        );
    }
}
