use super::DomainAlertsRepository;
use super::models::DomainAlertRow;
use crate::connection::run_migrations;
use crate::schema::domain_alerts;
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use chrono::NaiveDate;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::features::domain_alerts::{
    AlertInsertOutcome, DomainAlertReadState, DomainAlertSeverity, DomainAlertsRepositoryTrait,
    ListDomainAlertsQuery, NewDomainAlert,
};

fn setup(temp_db: &TempDb) -> DomainAlertsRepository {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.clone()).expect("writer");
    DomainAlertsRepository::new(Arc::new(pool), writer)
}

fn sample_alert(producer_key: &str, occurrence_key: &str, title: &str) -> NewDomainAlert {
    NewDomainAlert {
        id: None,
        producer_key: producer_key.to_string(),
        occurrence_key: occurrence_key.to_string(),
        severity: DomainAlertSeverity::Info,
        title: title.to_string(),
        body: "Body text".to_string(),
        destination: None,
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
    }
}

async fn insert_alert_with_created_at(
    db_path: &str,
    repo: &DomainAlertsRepository,
    alert: NewDomainAlert,
    created_at: chrono::NaiveDateTime,
) {
    let outcome = repo.insert(alert).await.expect("insert");
    let AlertInsertOutcome::Created(created) = outcome else {
        panic!("expected created alert");
    };
    let mut conn = SqliteConnection::establish(db_path).expect("connect");
    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(created.id)))
        .set(domain_alerts::created_at.eq(created_at))
        .execute(&mut conn)
        .expect("set created_at");
}

#[tokio::test]
async fn list_returns_newest_first_with_exact_limit() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let base = NaiveDate::from_ymd_opt(2026, 7, 14)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap();
    insert_alert_with_created_at(
        temp_db.path(),
        &repo,
        sample_alert("budget.status", "a", "Oldest"),
        base,
    )
    .await;
    insert_alert_with_created_at(
        temp_db.path(),
        &repo,
        sample_alert("budget.status", "b", "Middle"),
        base + chrono::Duration::seconds(1),
    )
    .await;
    insert_alert_with_created_at(
        temp_db.path(),
        &repo,
        sample_alert("budget.status", "c", "Newest"),
        base + chrono::Duration::seconds(2),
    )
    .await;

    let page = repo
        .list_alerts(&ListDomainAlertsQuery {
            limit: Some(2),
            ..Default::default()
        })
        .await
        .expect("list");

    assert_eq!(page.items.len(), 2);
    assert_eq!(page.items[0].title, "Newest");
    assert_eq!(page.items[1].title, "Middle");
    assert!(page.next_cursor.is_some());
}

#[tokio::test]
async fn unread_count_returns_exact_unread_total() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    insert_alert(&repo, sample_alert("budget.status", "a", "Unread")).await;
    let read_row = insert_alert(&repo, sample_alert("budget.status", "b", "Read")).await;
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("connect");
    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(read_row.id)))
        .set(domain_alerts::read_at.eq(Some(
            NaiveDate::from_ymd_opt(2026, 7, 14)
                .unwrap()
                .and_hms_opt(12, 0, 0)
                .unwrap(),
        )))
        .execute(&mut conn)
        .expect("mark read");

    assert_eq!(repo.unread_count().await.expect("count"), 1);
}

#[tokio::test]
async fn list_filters_by_unread_state() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    insert_alert(&repo, sample_alert("budget.status", "a", "Unread")).await;
    let read_row = insert_alert(&repo, sample_alert("budget.status", "b", "Read")).await;
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("connect");
    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(read_row.id)))
        .set(domain_alerts::read_at.eq(Some(
            NaiveDate::from_ymd_opt(2026, 7, 14)
                .unwrap()
                .and_hms_opt(12, 0, 0)
                .unwrap(),
        )))
        .execute(&mut conn)
        .expect("mark read");

    let page = repo
        .list_alerts(&ListDomainAlertsQuery {
            read_state: Some(DomainAlertReadState::Unread),
            ..Default::default()
        })
        .await
        .expect("list");

    assert_eq!(page.items.len(), 1);
    assert_eq!(page.items[0].title, "Unread");
}
