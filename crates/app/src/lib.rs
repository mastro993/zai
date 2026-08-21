use std::{path::Path, sync::Arc};

use zai_core::features::budgets::traits::{CalendarClock, LocalCalendarClock};
use zai_core::features::domain_alerts::DomainAlertEventBus;
use zai_core::features::recurring_transactions::{
    RecurringProcessingEventBus, RecurringProcessingSupervisor,
    RecurringProcessingSupervisorHandle, RecurringTransactionsService,
};
use zai_core::features::{
    budgets::{service::BudgetsService, traits::BudgetsServiceTrait},
    currency::{CurrencyJobStatus, CurrencyService, CurrencyStateEventBus},
    domain_alerts::{DomainAlertsService, DomainAlertsServiceTrait},
    transaction_categories::{
        service::TransactionCategoriesService, traits::TransactionCategoriesServiceTrait,
    },
    transactions::{
        import_service::TransactionImportService, service::TransactionsService,
        traits::TransactionsServiceTrait,
    },
};

mod currency_refresh;
pub use currency_refresh::CurrencyRefreshHandle;
mod ecb;
mod recurring_supervisor;
use currency_refresh::CurrencyRefreshSupervisor;
use ecb::EcbHttpAdapter;
use recurring_supervisor::{ProcessDelayAlertPort, RepositorySupervisorHeads};
use zai_core::features::exchange_rates::{ExchangeRateService, SystemUtcClock};

pub struct ServiceContext {
    pub budgets_service: Arc<dyn BudgetsServiceTrait>,
    pub currency_service: Arc<CurrencyService>,
    pub exchange_rate_service: Arc<ExchangeRateService>,
    pub domain_alerts_service: Arc<dyn DomainAlertsServiceTrait>,
    pub recurring_transactions_service: Arc<RecurringTransactionsService>,
    pub transaction_categories_service: Arc<dyn TransactionCategoriesServiceTrait>,
    pub transactions_service: Arc<dyn TransactionsServiceTrait>,
    pub transaction_import_service: Arc<TransactionImportService>,
    pub domain_alert_event_bus: Arc<DomainAlertEventBus>,
    pub recurring_processing_event_bus: Arc<RecurringProcessingEventBus>,
    pub currency_state_event_bus: Arc<CurrencyStateEventBus>,
    pub recurring_processing_supervisor: RecurringProcessingSupervisorHandle,
    pub currency_refresh_supervisor: CurrencyRefreshHandle,
    pub domain_alerts_repository: Arc<zai_db::domain_alerts::DomainAlertsRepository>,
}

impl ServiceContext {
    pub fn budgets_service(&self) -> Arc<dyn BudgetsServiceTrait> {
        Arc::clone(&self.budgets_service)
    }

    pub fn currency_service(&self) -> Arc<CurrencyService> {
        Arc::clone(&self.currency_service)
    }

    pub fn exchange_rate_service(&self) -> Arc<ExchangeRateService> {
        Arc::clone(&self.exchange_rate_service)
    }

    pub fn domain_alerts_service(&self) -> Arc<dyn DomainAlertsServiceTrait> {
        Arc::clone(&self.domain_alerts_service)
    }

    pub fn recurring_transactions_service(&self) -> Arc<RecurringTransactionsService> {
        Arc::clone(&self.recurring_transactions_service)
    }

    pub fn transaction_categories_service(&self) -> Arc<dyn TransactionCategoriesServiceTrait> {
        Arc::clone(&self.transaction_categories_service)
    }

    pub fn transactions_service(&self) -> Arc<dyn TransactionsServiceTrait> {
        Arc::clone(&self.transactions_service)
    }

    pub fn transaction_import_service(&self) -> Arc<TransactionImportService> {
        Arc::clone(&self.transaction_import_service)
    }

    pub fn domain_alert_event_bus(&self) -> Arc<DomainAlertEventBus> {
        Arc::clone(&self.domain_alert_event_bus)
    }

    pub fn recurring_processing_event_bus(&self) -> Arc<RecurringProcessingEventBus> {
        Arc::clone(&self.recurring_processing_event_bus)
    }

    pub fn currency_state_event_bus(&self) -> Arc<CurrencyStateEventBus> {
        Arc::clone(&self.currency_state_event_bus)
    }

    pub fn spawn_currency_job_drive(&self) {
        let service = self.currency_service();
        let exchange = self.exchange_rate_service();
        let import = self.transaction_import_service();
        let events = self.currency_state_event_bus();
        tokio::spawn(async move {
            let job_type = service
                .status()
                .ok()
                .and_then(|status| status.job)
                .map(|job| job.job_type);
            match job_type {
                Some(zai_core::features::currency::CurrencyJobType::ImportPreview) => {
                    let _ = crate::currency_refresh::refresh_reporting_progress(
                        &exchange,
                        events.as_ref(),
                    )
                    .await;
                    let _ = import.drive_running_preview();
                }
                Some(zai_core::features::currency::CurrencyJobType::AddCurrency) => {
                    if let Ok(status) = service.status()
                        && let Some(job) = status.job
                        && job
                            .currency_code
                            .as_deref()
                            .is_some_and(zai_core::features::currency::needs_provider)
                    {
                        let _ = crate::currency_refresh::refresh_reporting_progress(
                            &exchange,
                            events.as_ref(),
                        )
                        .await;
                    }
                    let _ = tokio::task::spawn_blocking(move || service.drive_running_job()).await;
                }
                _ => {
                    let _ = tokio::task::spawn_blocking(move || service.drive_running_job()).await;
                }
            }
        });
    }

    pub fn adopt_leftover_currency_jobs(&self) {
        let running = self
            .currency_service()
            .status()
            .ok()
            .and_then(|status| status.job)
            .is_some_and(|job| job.status == CurrencyJobStatus::Running);
        if running {
            self.spawn_currency_job_drive();
        }
    }

    pub async fn retry_exchange_rate_refresh(&self) {
        let _ = crate::currency_refresh::run_provider_refresh(
            &self.exchange_rate_service(),
            &self.currency_service,
            &self.domain_alerts_repository,
            self.currency_state_event_bus().as_ref(),
        )
        .await;
    }

    pub fn recurring_processing_supervisor(&self) -> RecurringProcessingSupervisorHandle {
        self.recurring_processing_supervisor.clone()
    }

    pub fn currency_refresh_supervisor(&self) -> CurrencyRefreshHandle {
        self.currency_refresh_supervisor.clone()
    }
}

pub struct BootstrappedApp {
    pub context: ServiceContext,
    pub supervisor: RecurringProcessingSupervisor,
    pub currency_refresh: CurrencyRefreshSupervisor,
}

pub fn initialize_context(app_data_dir: impl AsRef<Path>) -> zai_core::Result<ServiceContext> {
    Ok(bootstrap_context(app_data_dir)?.context)
}

pub fn bootstrap_context(app_data_dir: impl AsRef<Path>) -> zai_core::Result<BootstrappedApp> {
    bootstrap_context_with_clock(app_data_dir, Arc::new(LocalCalendarClock))
}

pub fn bootstrap_context_with_clock(
    app_data_dir: impl AsRef<Path>,
    clock: Arc<dyn CalendarClock>,
) -> zai_core::Result<BootstrappedApp> {
    let domain_alert_event_bus = DomainAlertEventBus::new();
    let recurring_processing_event_bus = RecurringProcessingEventBus::new();
    let currency_state_event_bus = CurrencyStateEventBus::new();
    bootstrap_context_with_buses_and_clock(
        app_data_dir,
        domain_alert_event_bus,
        recurring_processing_event_bus,
        currency_state_event_bus,
        clock,
    )
}

pub fn initialize_context_with_clock(
    app_data_dir: impl AsRef<Path>,
    clock: Arc<dyn CalendarClock>,
) -> zai_core::Result<ServiceContext> {
    Ok(bootstrap_context_with_clock(app_data_dir, clock)?.context)
}

pub fn initialize_context_with_event_bus(
    app_data_dir: impl AsRef<Path>,
    domain_alert_event_bus: Arc<DomainAlertEventBus>,
) -> zai_core::Result<ServiceContext> {
    Ok(bootstrap_context_with_buses(
        app_data_dir,
        domain_alert_event_bus,
        RecurringProcessingEventBus::new(),
        CurrencyStateEventBus::new(),
    )?
    .context)
}

pub fn bootstrap_context_with_buses(
    app_data_dir: impl AsRef<Path>,
    domain_alert_event_bus: Arc<DomainAlertEventBus>,
    recurring_processing_event_bus: Arc<RecurringProcessingEventBus>,
    currency_state_event_bus: Arc<CurrencyStateEventBus>,
) -> zai_core::Result<BootstrappedApp> {
    bootstrap_context_with_buses_and_clock(
        app_data_dir,
        domain_alert_event_bus,
        recurring_processing_event_bus,
        currency_state_event_bus,
        Arc::new(LocalCalendarClock),
    )
}

pub fn bootstrap_context_with_buses_and_clock(
    app_data_dir: impl AsRef<Path>,
    domain_alert_event_bus: Arc<DomainAlertEventBus>,
    recurring_processing_event_bus: Arc<RecurringProcessingEventBus>,
    currency_state_event_bus: Arc<CurrencyStateEventBus>,
    clock: Arc<dyn CalendarClock>,
) -> zai_core::Result<BootstrappedApp> {
    let database = zai_db::connect_with_event_bus_and_clock(
        app_data_dir,
        Arc::clone(&domain_alert_event_bus),
        Arc::clone(&clock),
    )?;
    log::info!("Database initialized at {}", database.path().display());

    let currency_service = Arc::new(CurrencyService::new(
        database.currency_settings_repository(),
        currency_state_event_bus.clone(),
    ));
    let exchange_rate_service = Arc::new(ExchangeRateService::new(
        Arc::new(EcbHttpAdapter::production()?),
        database.exchange_rate_repository(),
        Arc::new(SystemUtcClock),
    ));
    let transaction_categories_repository = database.transaction_categories_repository();
    let transactions_repository = database.transactions_repository();
    let transaction_import_service = Arc::new(TransactionImportService::new(
        currency_service.clone(),
        database.currency_settings_repository(),
        transactions_repository.clone(),
    ));
    let budgets_repository = database.budgets_repository();
    let domain_alerts_repository = database.domain_alerts_repository();
    let recurring_transactions_repository = database.recurring_transactions_repository();
    let heads = Arc::new(RepositorySupervisorHeads::new(
        recurring_transactions_repository.clone(),
    ));
    let delay_alerts = Arc::new(ProcessDelayAlertPort::new(domain_alerts_repository.clone()));

    let recurring_transactions_service = Arc::new(
        RecurringTransactionsService::new(recurring_transactions_repository, Arc::clone(&clock))
            .with_currency_setup(currency_service.clone()),
    );
    let supervisor = RecurringProcessingSupervisor::new(
        recurring_transactions_service.clone(),
        clock,
        heads,
        recurring_processing_event_bus.clone()
            as Arc<
                dyn zai_core::features::recurring_transactions::RecurringProcessingEventPublisher,
            >,
        delay_alerts,
    );
    let handle = supervisor.handle();
    recurring_transactions_service.attach_wake(Arc::new(handle.clone()));
    let currency_refresh = CurrencyRefreshSupervisor::new(
        exchange_rate_service.clone(),
        currency_service.clone(),
        domain_alerts_repository.clone(),
        currency_state_event_bus.clone(),
    );
    let currency_refresh_handle = currency_refresh.handle();

    Ok(BootstrappedApp {
        context: ServiceContext {
            budgets_service: Arc::new(
                BudgetsService::new(budgets_repository)
                    .with_currency_setup(currency_service.clone()),
            ),
            currency_service: currency_service.clone(),
            exchange_rate_service,
            domain_alerts_service: Arc::new(DomainAlertsService::new(
                domain_alerts_repository.clone(),
            )),
            domain_alerts_repository,
            recurring_transactions_service,
            transaction_categories_service: Arc::new(TransactionCategoriesService::new(
                transaction_categories_repository,
            )),
            transactions_service: Arc::new(
                TransactionsService::new(transactions_repository)
                    .with_currency_setup(currency_service),
            ),
            transaction_import_service,
            domain_alert_event_bus,
            recurring_processing_event_bus,
            currency_state_event_bus,
            recurring_processing_supervisor: handle,
            currency_refresh_supervisor: currency_refresh_handle,
        },
        supervisor,
        currency_refresh,
    })
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::{Path, PathBuf},
    };

    use uuid::Uuid;

    use super::initialize_context;
    use zai_core::features::budgets::models::BudgetListFilter;

    struct TempAppDataDir {
        path: PathBuf,
    }

    impl TempAppDataDir {
        fn new() -> Self {
            Self {
                path: env::temp_dir().join(format!("zai-app-context-{}", Uuid::new_v4())),
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

    #[tokio::test]
    async fn shared_context_initializes_services_from_app_data_dir() {
        let app_data_dir = TempAppDataDir::new();

        let context = initialize_context(app_data_dir.path()).expect("context should initialize");
        context
            .currency_service()
            .complete_initial_setup("EUR")
            .expect("confirm EUR setup");

        assert!(app_data_dir.path().join("zai.db").exists());

        let categories = context
            .transaction_categories_service()
            .get_categories(None)
            .await
            .expect("categories service should query migrated database");
        let transactions = context
            .transactions_service()
            .get_transactions(1, 20, None, None)
            .await
            .expect("transactions service should query migrated database");
        let budgets = context
            .budgets_service()
            .list_budgets(BudgetListFilter::Active)
            .await
            .expect("budgets service should query migrated database");
        let recurring = context
            .recurring_transactions_service()
            .list_feed(None, None)
            .await
            .expect("recurring transactions service should query migrated database");

        assert!(categories.is_empty());
        assert!(transactions.data.is_empty());
        assert!(budgets.is_empty());
        assert!(recurring.items.is_empty());
        assert!(
            context
                .exchange_rate_service()
                .current_set()
                .await
                .expect("cache read")
                .is_none()
        );
    }

    #[tokio::test]
    async fn adding_non_ecb_catalog_currency_does_not_enable_without_rates() {
        use std::time::Duration;
        use zai_core::ErrorCode;
        use zai_core::features::currency::{
            CurrencyJobStatus, CurrencyLifecycleStatus, QuoteVariant,
        };

        let app_data_dir = TempAppDataDir::new();
        let context = initialize_context(app_data_dir.path()).expect("context");
        context
            .currency_service()
            .complete_initial_setup("EUR")
            .expect("confirm EUR");
        context
            .currency_service()
            .start_currency_addition("AED", true)
            .expect("start AED add");
        context.spawn_currency_job_drive();

        let job = tokio::time::timeout(Duration::from_secs(2), async {
            loop {
                let status = context.currency_service().status().expect("status");
                if let Some(job) = status.job
                    && job.status != CurrencyJobStatus::Running
                {
                    return job;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .expect("add job should finish");

        assert_ne!(
            job.status,
            CurrencyJobStatus::Succeeded,
            "AED has no ECB series; addition must not succeed without rates"
        );
        assert_eq!(
            job.error.as_ref().map(|error| error.code),
            Some(ErrorCode::IncompleteCoverage)
        );

        let rows = context
            .currency_service()
            .list_settings()
            .expect("settings");
        assert!(
            rows.iter()
                .all(|row| row.code != "AED" || row.status != CurrencyLifecycleStatus::Enabled),
            "AED must not become selectable without coverage"
        );

        let quote = context
            .currency_service()
            .quote("AED", "EUR", "2026-08-21")
            .expect("quote");
        assert_eq!(quote.variant, QuoteVariant::Pending);
        assert!(quote.rate.is_none());
        assert!(!quote.complete);
    }

    #[tokio::test]
    async fn leftover_running_default_change_is_adopted() {
        use diesel::prelude::*;
        use diesel::sql_query;
        use diesel::sqlite::SqliteConnection;
        use std::time::Duration;
        use zai_core::features::currency::CurrencyJobStatus;

        let app_data_dir = TempAppDataDir::new();
        let context = initialize_context(app_data_dir.path()).expect("context");
        context
            .currency_service()
            .complete_initial_setup("EUR")
            .expect("confirm EUR");
        let mut connection =
            SqliteConnection::establish(app_data_dir.path().join("zai.db").to_str().expect("path"))
                .expect("open sqlite");
        sql_query(
            "INSERT INTO enabled_currencies (code, enabled_at, disabled_at) \
             VALUES ('USD', datetime('now'), NULL)",
        )
        .execute(&mut connection)
        .expect("enable USD");
        drop(connection);

        let job = context
            .currency_service()
            .start_default_currency_change("USD")
            .expect("start change");
        assert_eq!(job.status, CurrencyJobStatus::Running);

        context.adopt_leftover_currency_jobs();
        let finished = tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                let status = context.currency_service().status().expect("status");
                if let Some(job) = status.job
                    && job.status != CurrencyJobStatus::Running
                {
                    return job;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .expect("leftover job should finish");
        assert_eq!(finished.status, CurrencyJobStatus::Succeeded);
        assert_eq!(
            context
                .currency_service()
                .bootstrap()
                .expect("bootstrap")
                .default_currency
                .as_deref(),
            Some("USD")
        );
    }
}
