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

fn sample_alert(
    producer_key: &str,
    occurrence_key: &str,
    title: &str,
    severity: DomainAlertSeverity,
) -> NewDomainAlert {
    NewDomainAlert {
        id: None,
        producer_key: producer_key.to_string(),
        occurrence_key: occurrence_key.to_string(),
        severity,
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
        updated_at: alert.created_at,
        resolved_at: None,
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
        .set((
            domain_alerts::created_at.eq(created_at),
            domain_alerts::updated_at.eq(created_at),
        ))
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
        sample_alert("budget.status", "a", "Oldest", DomainAlertSeverity::Info),
        base,
    )
    .await;
    insert_alert_with_created_at(
        temp_db.path(),
        &repo,
        sample_alert("budget.status", "b", "Middle", DomainAlertSeverity::Info),
        base + chrono::Duration::seconds(1),
    )
    .await;
    insert_alert_with_created_at(
        temp_db.path(),
        &repo,
        sample_alert("budget.status", "c", "Newest", DomainAlertSeverity::Info),
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
    insert_alert(
        &repo,
        sample_alert("budget.status", "a", "Unread", DomainAlertSeverity::Info),
    )
    .await;
    let read_row = insert_alert(
        &repo,
        sample_alert("budget.status", "b", "Read", DomainAlertSeverity::Info),
    )
    .await;
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("connect");
    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(read_row.id)))
        .set(
            domain_alerts::read_at.eq(Some(
                NaiveDate::from_ymd_opt(2026, 7, 14)
                    .unwrap()
                    .and_hms_opt(12, 0, 0)
                    .unwrap(),
            )),
        )
        .execute(&mut conn)
        .expect("mark read");

    assert_eq!(repo.unread_count().await.expect("count"), 1);
}

#[tokio::test]
async fn list_filters_by_unread_state() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    insert_alert(
        &repo,
        sample_alert("budget.status", "a", "Unread", DomainAlertSeverity::Info),
    )
    .await;
    let read_row = insert_alert(
        &repo,
        sample_alert("budget.status", "b", "Read", DomainAlertSeverity::Info),
    )
    .await;
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("connect");
    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(read_row.id)))
        .set(
            domain_alerts::read_at.eq(Some(
                NaiveDate::from_ymd_opt(2026, 7, 14)
                    .unwrap()
                    .and_hms_opt(12, 0, 0)
                    .unwrap(),
            )),
        )
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

#[tokio::test]
async fn list_filters_by_severity() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let base = NaiveDate::from_ymd_opt(2026, 7, 14)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap();
    insert_alert_with_created_at(
        temp_db.path(),
        &repo,
        sample_alert("budget.status", "a", "Info", DomainAlertSeverity::Info),
        base,
    )
    .await;
    insert_alert_with_created_at(
        temp_db.path(),
        &repo,
        sample_alert(
            "budget.status",
            "b",
            "Warning",
            DomainAlertSeverity::Warning,
        ),
        base + chrono::Duration::seconds(1),
    )
    .await;
    insert_alert_with_created_at(
        temp_db.path(),
        &repo,
        sample_alert(
            "budget.status",
            "c",
            "Critical",
            DomainAlertSeverity::Critical,
        ),
        base + chrono::Duration::seconds(2),
    )
    .await;

    let page = repo
        .list_alerts(&ListDomainAlertsQuery {
            severities: Some(vec![
                DomainAlertSeverity::Warning,
                DomainAlertSeverity::Critical,
            ]),
            ..Default::default()
        })
        .await
        .expect("list");

    assert_eq!(page.items.len(), 2);
    assert_eq!(page.items[0].title, "Critical");
    assert_eq!(page.items[1].title, "Warning");
}

#[tokio::test]
async fn list_combines_read_state_and_severity_filters() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    insert_alert(
        &repo,
        sample_alert(
            "budget.status",
            "a",
            "Unread warning",
            DomainAlertSeverity::Warning,
        ),
    )
    .await;
    insert_alert(
        &repo,
        sample_alert(
            "budget.status",
            "b",
            "Unread info",
            DomainAlertSeverity::Info,
        ),
    )
    .await;
    let read_row = insert_alert(
        &repo,
        sample_alert(
            "budget.status",
            "c",
            "Read warning",
            DomainAlertSeverity::Warning,
        ),
    )
    .await;
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("connect");
    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(read_row.id)))
        .set(
            domain_alerts::read_at.eq(Some(
                NaiveDate::from_ymd_opt(2026, 7, 14)
                    .unwrap()
                    .and_hms_opt(12, 0, 0)
                    .unwrap(),
            )),
        )
        .execute(&mut conn)
        .expect("mark read");

    let page = repo
        .list_alerts(&ListDomainAlertsQuery {
            read_state: Some(DomainAlertReadState::Unread),
            severities: Some(vec![DomainAlertSeverity::Warning]),
            ..Default::default()
        })
        .await
        .expect("list");

    assert_eq!(page.items.len(), 1);
    assert_eq!(page.items[0].title, "Unread warning");
}

#[tokio::test]
async fn list_cursor_pages_without_duplicates_or_skips() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let base = NaiveDate::from_ymd_opt(2026, 7, 14)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap();
    for (index, title) in ["A", "B", "C", "D", "E"].iter().enumerate() {
        insert_alert_with_created_at(
            temp_db.path(),
            &repo,
            sample_alert(
                "budget.status",
                &format!("occ-{index}"),
                title,
                DomainAlertSeverity::Info,
            ),
            base + chrono::Duration::seconds(index as i64),
        )
        .await;
    }

    let page_one = repo
        .list_alerts(&ListDomainAlertsQuery {
            limit: Some(2),
            ..Default::default()
        })
        .await
        .expect("page one");
    let page_two = repo
        .list_alerts(&ListDomainAlertsQuery {
            limit: Some(2),
            cursor: page_one.next_cursor.clone(),
            ..Default::default()
        })
        .await
        .expect("page two");
    let page_three = repo
        .list_alerts(&ListDomainAlertsQuery {
            limit: Some(2),
            cursor: page_two.next_cursor.clone(),
            ..Default::default()
        })
        .await
        .expect("page three");

    let titles: Vec<_> = [page_one.items, page_two.items, page_three.items]
        .into_iter()
        .flat_map(|page| page.into_iter().map(|alert| alert.title))
        .collect();

    assert_eq!(titles, vec!["E", "D", "C", "B", "A"]);
    assert!(page_two.next_cursor.is_some());
    assert!(page_three.next_cursor.is_none());
}

#[tokio::test]
async fn list_breaks_equal_created_at_ties_by_id_desc() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let created_at = NaiveDate::from_ymd_opt(2026, 7, 14)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap();
    for title in ["First", "Second", "Third"] {
        insert_alert_with_created_at(
            temp_db.path(),
            &repo,
            sample_alert(
                "budget.status",
                &format!("occ-{title}"),
                title,
                DomainAlertSeverity::Info,
            ),
            created_at,
        )
        .await;
    }

    let page = repo
        .list_alerts(&ListDomainAlertsQuery {
            limit: Some(3),
            ..Default::default()
        })
        .await
        .expect("list");

    assert_eq!(page.items.len(), 3);
    let ids: Vec<_> = page.items.iter().map(|alert| alert.id.clone()).collect();
    let mut sorted_ids = ids.clone();
    sorted_ids.sort_by(|left, right| right.cmp(left));
    assert_eq!(ids, sorted_ids);
}

#[tokio::test]
async fn list_rejects_malformed_cursor() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let error = repo
        .list_alerts(&ListDomainAlertsQuery {
            cursor: Some("not-a-cursor".to_string()),
            ..Default::default()
        })
        .await
        .expect_err("malformed cursor should fail");
    assert!(matches!(
        error,
        zai_core::Error::InvalidData(message) if message.contains("cursor")
    ));
}

#[tokio::test]
async fn list_reflects_lifecycle_changes_on_refresh_without_skipping_rows() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let base = NaiveDate::from_ymd_opt(2026, 7, 14)
        .unwrap()
        .and_hms_opt(12, 0, 0)
        .unwrap();
    insert_alert_with_created_at(
        temp_db.path(),
        &repo,
        sample_alert("budget.status", "a", "Unread", DomainAlertSeverity::Warning),
        base,
    )
    .await;
    insert_alert_with_created_at(
        temp_db.path(),
        &repo,
        sample_alert(
            "budget.status",
            "b",
            "Will read",
            DomainAlertSeverity::Warning,
        ),
        base + chrono::Duration::seconds(1),
    )
    .await;
    insert_alert_with_created_at(
        temp_db.path(),
        &repo,
        sample_alert("budget.status", "c", "Newest", DomainAlertSeverity::Warning),
        base + chrono::Duration::seconds(2),
    )
    .await;

    let page_one = repo
        .list_alerts(&ListDomainAlertsQuery {
            read_state: Some(DomainAlertReadState::Unread),
            severities: Some(vec![DomainAlertSeverity::Warning]),
            limit: Some(2),
            ..Default::default()
        })
        .await
        .expect("page one");
    assert_eq!(page_one.items.len(), 2);
    assert_eq!(page_one.items[0].title, "Newest");

    let mut conn = SqliteConnection::establish(temp_db.path()).expect("connect");
    let read_row = domain_alerts::table
        .filter(domain_alerts::title.eq("Will read"))
        .select(DomainAlertRow::as_select())
        .first::<DomainAlertRow>(&mut conn)
        .expect("read row");
    diesel::update(domain_alerts::table.filter(domain_alerts::id.eq(read_row.id)))
        .set(
            domain_alerts::read_at.eq(Some(
                NaiveDate::from_ymd_opt(2026, 7, 14)
                    .unwrap()
                    .and_hms_opt(12, 1, 0)
                    .unwrap(),
            )),
        )
        .execute(&mut conn)
        .expect("mark read");

    let page_two = repo
        .list_alerts(&ListDomainAlertsQuery {
            read_state: Some(DomainAlertReadState::Unread),
            severities: Some(vec![DomainAlertSeverity::Warning]),
            cursor: page_one.next_cursor,
            ..Default::default()
        })
        .await
        .expect("page two");

    let refreshed = repo
        .list_alerts(&ListDomainAlertsQuery {
            read_state: Some(DomainAlertReadState::Unread),
            severities: Some(vec![DomainAlertSeverity::Warning]),
            limit: Some(2),
            ..Default::default()
        })
        .await
        .expect("refresh");

    assert_eq!(page_two.items.len(), 1);
    assert_eq!(page_two.items[0].title, "Unread");
    assert_eq!(refreshed.items.len(), 2);
    assert_eq!(refreshed.items[0].title, "Newest");
    assert_eq!(refreshed.items[1].title, "Unread");
}
