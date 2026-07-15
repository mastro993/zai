use crate::budgets::repository::BudgetsRepository;
use crate::connection::run_migrations;
use crate::domain_alerts::DomainAlertsRepository;
use crate::schema::domain_alerts;
use crate::test_utils::TempDb;
use crate::transactions::TransactionsRepository;
use crate::write_actor::spawn_writer;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::{Arc, Mutex};
use uuid::Uuid;
use zai_core::features::budgets::alerts::BUDGET_STATUS_PRODUCER_KEY;
use zai_core::features::budgets::models::{
    BudgetCadence, BudgetListFilter, BudgetStatus, NewBudget,
};
use zai_core::features::budgets::traits::BudgetsRepositoryTrait;
use zai_core::features::domain_alerts::{
    DomainAlertEvent, DomainAlertEventPublisher, DomainAlertPublicationError, DomainAlertSeverity,
    DomainAlertsRepositoryTrait,
};
use zai_core::features::transactions::models::NewTransaction;
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;

#[derive(Clone, Default)]
struct RecordingPublisher {
    events: Arc<Mutex<Vec<DomainAlertEvent>>>,
}

impl DomainAlertEventPublisher for RecordingPublisher {
    fn publish(&self, event: &DomainAlertEvent) -> Result<(), DomainAlertPublicationError> {
        self.events.lock().expect("events lock").push(event.clone());
        Ok(())
    }
}

fn setup(
    temp_db: &TempDb,
    publisher: Arc<dyn DomainAlertEventPublisher>,
) -> (
    BudgetsRepository,
    TransactionsRepository,
    DomainAlertsRepository,
) {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.clone()).expect("writer");
    let pool = Arc::new(pool);
    let budgets = BudgetsRepository::new_with_clock_and_publisher(
        Arc::clone(&pool),
        writer.clone(),
        Arc::new(zai_core::features::budgets::traits::LocalCalendarClock),
        Arc::clone(&publisher),
    );
    let transactions = TransactionsRepository::new_with_clock_and_publisher(
        Arc::clone(&pool),
        writer.clone(),
        Arc::new(zai_core::features::budgets::traits::LocalCalendarClock),
        Arc::clone(&publisher),
    );
    let alerts = DomainAlertsRepository::new_with_publisher(pool, writer, publisher);
    (budgets, transactions, alerts)
}

#[tokio::test]
async fn creating_budget_with_overspent_period_is_silent() {
    let temp_db = TempDb::new();
    let publisher = RecordingPublisher::default();
    let (budgets, transactions, alerts) = setup(&temp_db, Arc::new(publisher.clone()));
    let budget_id = Uuid::new_v4().to_string();

    transactions
        .create_transaction(NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some("Big spend".to_string()),
            amount: 15_000,
            transaction_date: chrono::Local::now().naive_local(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("transaction");

    budgets
        .create_budget(NewBudget {
            id: Some(budget_id.clone()),
            name: "Groceries".to_string(),
            base_allowance: 10_000,
            cadence: Some(BudgetCadence::Month),
            category_ids: Vec::new(),
            measurement_mode: None,
            rollover_mode: None,
            warning_percentage: Some(80),
        })
        .await
        .expect("budget");

    let listed = budgets
        .list_budgets(BudgetListFilter::Active)
        .await
        .expect("list");
    assert_eq!(listed[0].current_period.status, BudgetStatus::Overspent);
    assert!(publisher.events.lock().expect("lock").is_empty());
    assert_eq!(alerts.unread_count().await.expect("count"), 0);
}

#[tokio::test]
async fn transaction_transition_to_overspent_persists_and_publishes_critical_alert() {
    let temp_db = TempDb::new();
    let publisher = RecordingPublisher::default();
    let (budgets, transactions, alerts) = setup(&temp_db, Arc::new(publisher.clone()));
    let budget_id = Uuid::new_v4().to_string();

    budgets
        .create_budget(NewBudget {
            id: Some(budget_id.clone()),
            name: "Groceries".to_string(),
            base_allowance: 10_000,
            cadence: Some(BudgetCadence::Month),
            category_ids: Vec::new(),
            measurement_mode: None,
            rollover_mode: None,
            warning_percentage: Some(80),
        })
        .await
        .expect("budget");

    transactions
        .create_transaction(NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some("Big spend".to_string()),
            amount: 15_000,
            transaction_date: chrono::Local::now().naive_local(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("transaction");

    let page = alerts.list_alerts(&Default::default()).await.expect("list");
    assert_eq!(page.items.len(), 1);
    let alert = &page.items[0];
    assert_eq!(alert.producer_key, BUDGET_STATUS_PRODUCER_KEY);
    assert_eq!(alert.severity, DomainAlertSeverity::Critical);
    assert!(alert.title.contains("Groceries"));
    assert!(
        alert
            .data
            .as_ref()
            .is_some_and(|data| data.kind == "budget.status")
    );

    let events = publisher.events.lock().expect("lock");
    assert_eq!(events.len(), 1);
    assert!(matches!(events[0], DomainAlertEvent::Created { .. }));
}

#[tokio::test]
async fn duplicate_occurrence_preserves_first_alert_without_failing_mutation() {
    let temp_db = TempDb::new();
    let publisher = RecordingPublisher::default();
    let (budgets, transactions, alerts) = setup(&temp_db, Arc::new(publisher));
    let budget_id = Uuid::new_v4().to_string();

    budgets
        .create_budget(NewBudget {
            id: Some(budget_id),
            name: "Groceries".to_string(),
            base_allowance: 1_000,
            cadence: Some(BudgetCadence::Month),
            category_ids: Vec::new(),
            measurement_mode: None,
            rollover_mode: None,
            warning_percentage: Some(80),
        })
        .await
        .expect("budget");

    let overspend = || NewTransaction {
        id: Some(Uuid::new_v4().to_string()),
        description: Some("Spend".to_string()),
        amount: 2_000,
        transaction_date: chrono::Local::now().naive_local(),
        transaction_type: "expense".to_string(),
        transaction_category_id: None,
        notes: None,
    };

    transactions
        .create_transaction(overspend())
        .await
        .expect("first transaction");
    transactions
        .create_transaction(overspend())
        .await
        .expect("second transaction");

    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    let mut conn = pool.get().expect("conn");
    let count = domain_alerts::table
        .count()
        .get_result::<i64>(&mut conn)
        .expect("count");
    assert_eq!(count, 1);
    assert_eq!(alerts.unread_count().await.expect("unread"), 1);
}
