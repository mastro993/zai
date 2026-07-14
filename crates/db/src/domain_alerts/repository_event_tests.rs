use super::DomainAlertsRepository;
use crate::connection::run_migrations;
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::{Arc, Mutex};
use zai_core::features::domain_alerts::{
    AlertInsertOutcome, DomainAlertDestination, DomainAlertEvent, DomainAlertEventPublisher,
    DomainAlertPublicationError, DomainAlertSeverity, DomainAlertsRepositoryTrait, NewDomainAlert,
};

#[derive(Clone, Default)]
struct RecordingPublisher {
    events: Arc<Mutex<Vec<DomainAlertEvent>>>,
}

impl RecordingPublisher {
    fn snapshot(&self) -> Vec<DomainAlertEvent> {
        self.events.lock().expect("events lock").clone()
    }
}

impl DomainAlertEventPublisher for RecordingPublisher {
    fn publish(&self, event: &DomainAlertEvent) -> Result<(), DomainAlertPublicationError> {
        self.events.lock().expect("events lock").push(event.clone());
        Ok(())
    }
}

struct FailingPublisher;

impl DomainAlertEventPublisher for FailingPublisher {
    fn publish(&self, _event: &DomainAlertEvent) -> Result<(), DomainAlertPublicationError> {
        Err(DomainAlertPublicationError::ChannelUnavailable)
    }
}

fn setup(
    temp_db: &TempDb,
    publisher: Arc<dyn DomainAlertEventPublisher>,
) -> DomainAlertsRepository {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.clone()).expect("writer");
    DomainAlertsRepository::new_with_publisher(Arc::new(pool), writer, publisher)
}

fn sample_alert(occurrence_key: &str) -> NewDomainAlert {
    NewDomainAlert {
        id: None,
        producer_key: "budget.status".to_string(),
        occurrence_key: occurrence_key.to_string(),
        severity: DomainAlertSeverity::Warning,
        title: "Budget warning".to_string(),
        body: "Spending exceeded 80% of allowance.".to_string(),
        destination: Some(DomainAlertDestination::Budget {
            budget_id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8".to_string(),
        }),
        data: None,
    }
}

#[tokio::test]
async fn publishes_created_only_after_a_new_commit() {
    let temp_db = TempDb::new();
    let publisher = RecordingPublisher::default();
    let repo = setup(&temp_db, Arc::new(publisher.clone()));

    let created = repo.insert(sample_alert("period-1")).await.expect("insert");
    assert!(matches!(created, AlertInsertOutcome::Created(_)));
    assert!(matches!(
        publisher.snapshot().as_slice(),
        [DomainAlertEvent::Created { .. }]
    ));

    repo.insert(sample_alert("period-1"))
        .await
        .expect("duplicate insert");
    assert_eq!(publisher.snapshot().len(), 1);
}

#[tokio::test]
async fn publishes_state_changed_only_when_lifecycle_state_changes() {
    let temp_db = TempDb::new();
    let publisher = RecordingPublisher::default();
    let repo = setup(&temp_db, Arc::new(publisher.clone()));
    let AlertInsertOutcome::Created(alert) =
        repo.insert(sample_alert("period-2")).await.expect("insert")
    else {
        panic!("expected created alert");
    };

    repo.mark_read(&alert.id).await.expect("mark read");
    repo.mark_read(&alert.id).await.expect("repeat mark read");
    repo.mark_unread(&alert.id).await.expect("mark unread");
    repo.mark_unread(&alert.id)
        .await
        .expect("repeat mark unread");

    assert_eq!(
        publisher.snapshot(),
        vec![
            DomainAlertEvent::Created {
                alert: Box::new(*alert),
            },
            DomainAlertEvent::StateChanged,
            DomainAlertEvent::StateChanged,
        ]
    );
}

#[tokio::test]
async fn publisher_failure_does_not_change_successful_mutations() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db, Arc::new(FailingPublisher));

    let AlertInsertOutcome::Created(alert) = repo
        .insert(sample_alert("period-3"))
        .await
        .expect("insert should succeed")
    else {
        panic!("expected created alert");
    };
    let read = repo
        .mark_read(&alert.id)
        .await
        .expect("mark read should succeed");

    assert!(read.read_at.is_some());
    assert_eq!(repo.unread_count().await.expect("unread count"), 0);
}
