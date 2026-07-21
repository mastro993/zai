use std::{path::Path, sync::Arc};

use zai_core::features::budgets::traits::LocalCalendarClock;
use zai_core::features::domain_alerts::DomainAlertEventBus;
use zai_core::features::recurring_transactions::{
    RecurringProcessingEventBus, RecurringProcessingSupervisor,
    RecurringProcessingSupervisorHandle, RecurringTransactionsService,
};
use zai_core::features::{
    budgets::{service::BudgetsService, traits::BudgetsServiceTrait},
    domain_alerts::{DomainAlertsService, DomainAlertsServiceTrait},
    recurring_transactions::RecurringTransactionsServiceTrait,
    transaction_categories::{
        service::TransactionCategoriesService, traits::TransactionCategoriesServiceTrait,
    },
    transactions::{service::TransactionsService, traits::TransactionsServiceTrait},
};

mod recurring_supervisor;
use recurring_supervisor::{ProcessDelayAlertPort, RepositorySupervisorHeads};

pub struct ServiceContext {
    pub budgets_service: Arc<dyn BudgetsServiceTrait>,
    pub domain_alerts_service: Arc<dyn DomainAlertsServiceTrait>,
    pub recurring_transactions_service: Arc<dyn RecurringTransactionsServiceTrait>,
    pub transaction_categories_service: Arc<dyn TransactionCategoriesServiceTrait>,
    pub transactions_service: Arc<dyn TransactionsServiceTrait>,
    pub domain_alert_event_bus: Arc<DomainAlertEventBus>,
    pub recurring_processing_event_bus: Arc<RecurringProcessingEventBus>,
    pub recurring_processing_supervisor: RecurringProcessingSupervisorHandle,
}

impl ServiceContext {
    pub fn budgets_service(&self) -> Arc<dyn BudgetsServiceTrait> {
        Arc::clone(&self.budgets_service)
    }

    pub fn domain_alerts_service(&self) -> Arc<dyn DomainAlertsServiceTrait> {
        Arc::clone(&self.domain_alerts_service)
    }

    pub fn recurring_transactions_service(&self) -> Arc<dyn RecurringTransactionsServiceTrait> {
        Arc::clone(&self.recurring_transactions_service)
    }

    pub fn transaction_categories_service(&self) -> Arc<dyn TransactionCategoriesServiceTrait> {
        Arc::clone(&self.transaction_categories_service)
    }

    pub fn transactions_service(&self) -> Arc<dyn TransactionsServiceTrait> {
        Arc::clone(&self.transactions_service)
    }

    pub fn domain_alert_event_bus(&self) -> Arc<DomainAlertEventBus> {
        Arc::clone(&self.domain_alert_event_bus)
    }

    pub fn recurring_processing_event_bus(&self) -> Arc<RecurringProcessingEventBus> {
        Arc::clone(&self.recurring_processing_event_bus)
    }

    pub fn recurring_processing_supervisor(&self) -> RecurringProcessingSupervisorHandle {
        self.recurring_processing_supervisor.clone()
    }
}

pub struct BootstrappedApp {
    pub context: ServiceContext,
    pub supervisor: RecurringProcessingSupervisor,
}

pub fn initialize_context(app_data_dir: impl AsRef<Path>) -> zai_core::Result<ServiceContext> {
    Ok(bootstrap_context(app_data_dir)?.context)
}

pub fn bootstrap_context(app_data_dir: impl AsRef<Path>) -> zai_core::Result<BootstrappedApp> {
    let domain_alert_event_bus = DomainAlertEventBus::new();
    let recurring_processing_event_bus = RecurringProcessingEventBus::new();
    bootstrap_context_with_buses(
        app_data_dir,
        domain_alert_event_bus,
        recurring_processing_event_bus,
    )
}

pub fn initialize_context_with_event_bus(
    app_data_dir: impl AsRef<Path>,
    domain_alert_event_bus: Arc<DomainAlertEventBus>,
) -> zai_core::Result<ServiceContext> {
    Ok(bootstrap_context_with_buses(
        app_data_dir,
        domain_alert_event_bus,
        RecurringProcessingEventBus::new(),
    )?
    .context)
}

pub fn bootstrap_context_with_buses(
    app_data_dir: impl AsRef<Path>,
    domain_alert_event_bus: Arc<DomainAlertEventBus>,
    recurring_processing_event_bus: Arc<RecurringProcessingEventBus>,
) -> zai_core::Result<BootstrappedApp> {
    let database =
        zai_db::connect_with_event_bus(app_data_dir, Arc::clone(&domain_alert_event_bus))?;
    log::info!("Database initialized at {}", database.path().display());

    let transaction_categories_repository = database.transaction_categories_repository();
    let transactions_repository = database.transactions_repository();
    let budgets_repository = database.budgets_repository();
    let domain_alerts_repository = database.domain_alerts_repository();
    let recurring_transactions_repository = database.recurring_transactions_repository();
    let clock: Arc<dyn zai_core::features::budgets::traits::CalendarClock> =
        Arc::new(LocalCalendarClock);

    let heads = Arc::new(RepositorySupervisorHeads::new(
        recurring_transactions_repository.clone(),
    ));
    let delay_alerts = Arc::new(ProcessDelayAlertPort::new(domain_alerts_repository.clone()));

    let recurring_processor = Arc::new(RecurringTransactionsService::new(
        recurring_transactions_repository.clone(),
        Arc::clone(&clock),
    ));
    let supervisor = RecurringProcessingSupervisor::new(
        recurring_processor,
        Arc::clone(&clock),
        heads,
        recurring_processing_event_bus.clone()
            as Arc<
                dyn zai_core::features::recurring_transactions::RecurringProcessingEventPublisher,
            >,
        delay_alerts,
    );
    let handle = supervisor.handle();

    let recurring_transactions_service = Arc::new(
        RecurringTransactionsService::new(recurring_transactions_repository, clock)
            .with_wake(Arc::new(handle.clone())),
    );

    Ok(BootstrappedApp {
        context: ServiceContext {
            budgets_service: Arc::new(BudgetsService::new(budgets_repository)),
            domain_alerts_service: Arc::new(DomainAlertsService::new(domain_alerts_repository)),
            recurring_transactions_service,
            transaction_categories_service: Arc::new(TransactionCategoriesService::new(
                transaction_categories_repository,
            )),
            transactions_service: Arc::new(TransactionsService::new(transactions_repository)),
            domain_alert_event_bus,
            recurring_processing_event_bus,
            recurring_processing_supervisor: handle,
        },
        supervisor,
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
    async fn shared_context_initializes_cash_flow_services_from_app_data_dir() {
        let app_data_dir = TempAppDataDir::new();

        let context = initialize_context(app_data_dir.path()).expect("context should initialize");

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
    }
}
