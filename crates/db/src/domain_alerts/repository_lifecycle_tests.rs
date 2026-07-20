use super::DomainAlertsRepository;
use super::insert::insert_domain_alert;
use super::lifecycle::mark_all_domain_alerts_read;
use super::models::DomainAlertRow;
use crate::connection::run_migrations;
use crate::schema::domain_alerts;
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use chrono::NaiveDate;
use diesel::Connection;
use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::{Arc, Barrier, mpsc};
use std::thread;
use zai_core::Error;
use zai_core::features::domain_alerts::{
    AlertInsertOutcome, DomainAlertDestination, DomainAlertSeverity, DomainAlertsRepositoryTrait,
    NewDomainAlert,
};

fn setup(temp_db: &TempDb) -> DomainAlertsRepository {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.clone()).expect("writer");
    DomainAlertsRepository::new(Arc::new(pool), writer)
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

async fn insert_alert(repo: &DomainAlertsRepository, alert: NewDomainAlert) -> DomainAlertRow {
    let outcome = repo.insert(alert).await.expect("insert");
    let AlertInsertOutcome::Created(alert) = outcome else {
        panic!("expected created alert");
    };
    DomainAlertRow {
        id: alert.id,
        producer_key: alert.producer_key,
        occurrence_key: alert.occurrence_key,
        severity: alert.severity.as_str().to_string(),
        title: alert.title,
        body: alert.body,
        destination: None,
        data: None,
        created_at: alert.created_at,
        read_at: alert.read_at,
        updated_at: alert.created_at,
        resolved_at: None,
    }
}

#[tokio::test]
async fn mark_read_sets_utc_timestamp_only_when_unread() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let row = insert_alert(&repo, sample_alert("period-1")).await;

    let read = repo.mark_read(&row.id).await.expect("mark read");
    assert!(read.read_at.is_some());

    let first_read_at = read.read_at;
    let read_again = repo.mark_read(&row.id).await.expect("mark read again");
    assert_eq!(read_again.read_at, first_read_at);
}

#[tokio::test]
async fn mark_unread_clears_timestamp_only_when_read() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let row = insert_alert(&repo, sample_alert("period-2")).await;

    repo.mark_read(&row.id).await.expect("mark read");
    let unread = repo.mark_unread(&row.id).await.expect("mark unread");
    assert!(unread.read_at.is_none());

    let unread_again = repo.mark_unread(&row.id).await.expect("mark unread again");
    assert!(unread_again.read_at.is_none());
}

#[tokio::test]
async fn mark_lifecycle_returns_not_found_for_unknown_id() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let unknown_id = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";

    let read_error = repo.mark_read(unknown_id).await.expect_err("read");
    assert!(matches!(read_error, Error::NotFound(id) if id == unknown_id));

    let unread_error = repo.mark_unread(unknown_id).await.expect_err("unread");
    assert!(matches!(unread_error, Error::NotFound(id) if id == unknown_id));
}

#[tokio::test]
async fn mark_lifecycle_updates_unread_count() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let row = insert_alert(&repo, sample_alert("period-3")).await;

    assert_eq!(repo.unread_count().await.expect("count"), 1);
    repo.mark_read(&row.id).await.expect("mark read");
    assert_eq!(repo.unread_count().await.expect("count"), 0);
    repo.mark_unread(&row.id).await.expect("mark unread");
    assert_eq!(repo.unread_count().await.expect("count"), 1);
}

#[tokio::test]
async fn mark_all_read_returns_affected_count_and_is_idempotent() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let already_read = insert_alert(&repo, sample_alert("period-8")).await;
    let unread_one = insert_alert(&repo, sample_alert("period-9")).await;
    let unread_two = insert_alert(&repo, sample_alert("period-10")).await;

    let already_read = repo
        .mark_read(&already_read.id)
        .await
        .expect("mark existing alert read");
    let affected = repo.mark_all_read().await.expect("mark all read");

    assert_eq!(affected, 2);
    assert_eq!(repo.unread_count().await.expect("count"), 0);

    let page = repo
        .list_alerts(&Default::default())
        .await
        .expect("list alerts");
    let read_at = page
        .items
        .iter()
        .find(|alert| alert.id == unread_one.id)
        .and_then(|alert| alert.read_at)
        .expect("first unread alert should be read");
    assert_eq!(
        page.items
            .iter()
            .find(|alert| alert.id == unread_two.id)
            .and_then(|alert| alert.read_at),
        Some(read_at)
    );
    assert_eq!(
        page.items
            .iter()
            .find(|alert| alert.id == already_read.id)
            .and_then(|alert| alert.read_at),
        already_read.read_at
    );

    assert_eq!(repo.mark_all_read().await.expect("repeat mark all read"), 0);
    assert_eq!(repo.unread_count().await.expect("count"), 0);
    let repeated_page = repo
        .list_alerts(&Default::default())
        .await
        .expect("list alerts after repeat");
    for alert in &page.items {
        let repeated = repeated_page
            .items
            .iter()
            .find(|repeated| repeated.id == alert.id)
            .expect("repeated alert");
        assert_eq!(repeated.read_at, alert.read_at,);
        assert_eq!(repeated.created_at, alert.created_at);
    }
}

#[tokio::test]
async fn mark_all_read_does_not_change_alert_committed_after_transaction_begins() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    insert_alert(&repo, sample_alert("period-11")).await;

    let db_path = temp_db.path().to_string();
    let release = Arc::new(Barrier::new(2));
    let (updated_tx, updated_rx) = mpsc::channel();
    let marker_release = Arc::clone(&release);
    let marker = thread::spawn(move || {
        let mut conn = SqliteConnection::establish(&db_path).expect("marker connection");
        conn.batch_execute("PRAGMA busy_timeout = 30000;")
            .expect("marker busy timeout");
        conn.immediate_transaction(|conn| {
            let affected = mark_all_domain_alerts_read(conn).expect("mark all read");
            updated_tx.send(affected).expect("send affected count");
            marker_release.wait();
            Ok::<_, diesel::result::Error>(affected)
        })
        .expect("mark all transaction");
    });

    assert_eq!(updated_rx.recv().expect("affected count"), 1);

    let inserter_path = temp_db.path().to_string();
    let inserter = thread::spawn(move || {
        let mut conn = SqliteConnection::establish(&inserter_path).expect("inserter connection");
        conn.batch_execute("PRAGMA busy_timeout = 30000;")
            .expect("inserter busy timeout");
        conn.immediate_transaction(|conn| {
            insert_domain_alert(conn, &sample_alert("period-12")).expect("insert after mark");
            Ok::<_, diesel::result::Error>(())
        })
        .expect("insert transaction");
    });

    release.wait();
    marker.join().expect("marker thread");
    inserter.join().expect("inserter thread");

    let page = repo
        .list_alerts(&Default::default())
        .await
        .expect("list alerts");
    assert_eq!(
        page.items
            .iter()
            .find(|alert| alert.occurrence_key == "period-12")
            .and_then(|alert| alert.read_at),
        None
    );
}

#[tokio::test]
async fn concurrent_lifecycle_writes_use_last_committed_state() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let row = insert_alert(&repo, sample_alert("period-4")).await;

    repo.mark_read(&row.id).await.expect("mark read");
    repo.mark_unread(&row.id).await.expect("mark unread");
    let final_state = repo.mark_read(&row.id).await.expect("mark read final");

    assert!(final_state.read_at.is_some());
    assert_eq!(repo.unread_count().await.expect("count"), 0);
}

#[tokio::test]
async fn mark_read_preserves_immutable_alert_fields() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let row = insert_alert(&repo, sample_alert("period-5")).await;
    let read = repo.mark_read(&row.id).await.expect("mark read");

    assert_eq!(read.title, "Budget warning");
    assert_eq!(read.body, "Spending exceeded 80% of allowance.");
    assert_eq!(read.producer_key, "budget.status");
    assert_eq!(read.occurrence_key, "period-5");
}

#[tokio::test]
async fn mark_read_timestamp_is_database_assigned_utc() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let row = insert_alert(&repo, sample_alert("period-6")).await;
    let before = chrono::Utc::now().naive_utc();

    let read = repo.mark_read(&row.id).await.expect("mark read");
    let after = chrono::Utc::now().naive_utc();
    let read_at = read.read_at.expect("read_at");

    assert!(read_at >= before);
    assert!(read_at <= after);
}

#[tokio::test]
async fn mark_read_does_not_change_created_at() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let row = insert_alert(&repo, sample_alert("period-7")).await;
    let created_at = NaiveDate::from_ymd_opt(2026, 7, 10)
        .unwrap()
        .and_hms_opt(8, 0, 0)
        .unwrap();

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("connect");
    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(&row.id)))
        .set(domain_alerts::created_at.eq(created_at))
        .execute(&mut conn)
        .expect("set created_at");

    let read = repo.mark_read(&row.id).await.expect("mark read");
    assert_eq!(read.created_at, created_at);
}
