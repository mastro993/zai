use super::DomainAlertsRepository;
use super::models::DomainAlertRow;
use crate::connection::{get_connection, run_migrations};
use crate::domain_alerts::insert::insert_domain_alert;
use crate::schema::{domain_alerts, transaction_categories};
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use chrono::Utc;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sql_query;
use diesel::sqlite::SqliteConnection;
use diesel::{Connection, RunQueryDsl};
use std::sync::Arc;
use zai_core::Error;
use zai_core::features::domain_alerts::{
    AlertInsertOutcome, CommittedOutcome, DomainAlertDestination, DomainAlertRichData,
    DomainAlertSeverity, DomainAlertsRepositoryTrait, NewDomainAlert,
};

#[derive(Debug, diesel::QueryableByName)]
#[allow(dead_code)]
struct ExplainQueryPlanRow {
    #[diesel(sql_type = diesel::sql_types::Integer)]
    id: i32,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    parent: i32,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    notused: i32,
    #[diesel(sql_type = diesel::sql_types::Text)]
    detail: String,
}

fn explain_plan(connection: &mut SqliteConnection, query: &str) -> Vec<ExplainQueryPlanRow> {
    sql_query(query)
        .load::<ExplainQueryPlanRow>(connection)
        .expect("explain")
}

fn setup(temp_db: &TempDb) -> DomainAlertsRepository {
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.clone()).expect("writer");
    DomainAlertsRepository::new(Arc::new(pool), writer)
}

fn sample_alert(producer_key: &str, occurrence_key: &str) -> NewDomainAlert {
    NewDomainAlert {
        id: None,
        producer_key: producer_key.to_string(),
        occurrence_key: occurrence_key.to_string(),
        severity: DomainAlertSeverity::Warning,
        title: "Budget warning".to_string(),
        body: "Spending exceeded 80% of allowance.".to_string(),
        destination: Some(DomainAlertDestination::Budget {
            budget_id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8".to_string(),
        }),
        data: Some(DomainAlertRichData {
            kind: "budget.status".to_string(),
            version: 1,
            payload: serde_json::Map::from_iter([(
                "remainingAllowance".to_string(),
                serde_json::json!(-1500),
            )]),
        }),
    }
}

#[test]
fn insert_domain_alert_persists_row_in_immediate_transaction() {
    let temp_db = TempDb::new();
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let mut conn = SqliteConnection::establish(temp_db.path()).expect("connect");

    let outcome = conn
        .immediate_transaction(|conn| {
            insert_domain_alert(conn, &sample_alert("budget.status", "sync-1"))
        })
        .expect("transaction");

    assert!(matches!(outcome, AlertInsertOutcome::Created(_)));
}

#[tokio::test]
async fn insert_returns_created_with_persisted_timestamp() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let alert = sample_alert("budget.status", "period-1");

    let outcome = repo.insert(alert).await.expect("insert");

    let AlertInsertOutcome::Created(alert) = outcome else {
        panic!("expected created alert");
    };
    let persisted = repo.list_alerts(&Default::default()).await.expect("list");
    assert_eq!(persisted.items[0].created_at, alert.created_at);
    assert_eq!(alert.created_at, alert.updated_at);
    assert!(alert.read_at.is_none());
}

#[tokio::test]
async fn duplicate_insert_returns_already_exists_without_mutating_original() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let first = repo
        .insert(sample_alert("budget.status", "period-1"))
        .await
        .expect("first insert");
    let AlertInsertOutcome::Created(original) = first else {
        panic!("expected created alert");
    };

    let retry = repo
        .insert(NewDomainAlert {
            title: "Different title".to_string(),
            body: "Different body".to_string(),
            ..sample_alert("budget.status", "period-1")
        })
        .await
        .expect("retry insert");

    assert_eq!(retry, AlertInsertOutcome::AlreadyExists);

    let count = domain_alerts::table
        .count()
        .get_result::<i64>(&mut get_connection(repo.pool()).expect("connection"))
        .expect("count");
    assert_eq!(count, 1);

    let stored = domain_alerts::table
        .first::<DomainAlertRow>(&mut get_connection(repo.pool()).expect("connection"))
        .expect("stored alert");
    assert_eq!(stored.title, original.title);
    assert_eq!(stored.body, original.body);
}

#[tokio::test]
async fn producer_occurrence_keys_are_namespaced_per_producer() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);

    let first = repo
        .insert(sample_alert("budget.status", "shared-key"))
        .await
        .expect("first producer");
    let second = repo
        .insert(sample_alert("budget.lifecycle", "shared-key"))
        .await
        .expect("second producer");

    assert!(matches!(first, AlertInsertOutcome::Created(_)));
    assert!(matches!(second, AlertInsertOutcome::Created(_)));
}

#[tokio::test]
async fn sql_metacharacters_round_trip_in_keys_and_text() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let alert = NewDomainAlert {
        producer_key: "budget.status".to_string(),
        occurrence_key: "period' OR 1=1 --".to_string(),
        title: "Title with % and _ wildcards".to_string(),
        body: "Body with \"quotes\" and \\ backslashes".to_string(),
        ..sample_alert("ignored", "ignored")
    };

    let outcome = repo.insert(alert).await.expect("insert");
    let AlertInsertOutcome::Created(stored) = outcome else {
        panic!("expected created alert");
    };

    assert_eq!(stored.occurrence_key, "period' OR 1=1 --");
    assert_eq!(stored.title, "Title with % and _ wildcards");
    assert_eq!(stored.body, "Body with \"quotes\" and \\ backslashes");
}

#[tokio::test]
async fn domain_failure_rolls_back_alert_insert() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let alert = sample_alert("budget.status", "rollback-domain");

    let error = repo
        .writer()
        .exec(move |conn| -> crate::errors::Result<()> {
            insert_domain_alert(conn, &alert)?;
            Err(crate::errors::StorageError::CoreError(Error::Repository(
                "domain mutation failed".to_string(),
            )))
        })
        .await
        .expect_err("mutation should fail");

    assert!(matches!(error, Error::Repository(_)));

    let count = domain_alerts::table
        .count()
        .get_result::<i64>(&mut get_connection(repo.pool()).expect("connection"))
        .expect("count");
    assert_eq!(count, 0);
}

#[tokio::test]
async fn alert_failure_rolls_back_domain_insert() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let invalid_alert = NewDomainAlert {
        title: "   ".to_string(),
        ..sample_alert("budget.status", "rollback-alert")
    };

    let error = repo
        .writer()
        .exec(move |conn| {
            diesel::insert_into(transaction_categories::table)
                .values((
                    transaction_categories::id.eq("7c9e6679-7425-40de-944b-e07fc1f90ae7"),
                    transaction_categories::name.eq("Food"),
                    transaction_categories::role.eq("spending"),
                    transaction_categories::created_at.eq(Utc::now().naive_utc()),
                    transaction_categories::updated_at.eq(Utc::now().naive_utc()),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            insert_domain_alert(conn, &invalid_alert).map(|_| ())
        })
        .await
        .expect_err("alert insert should fail");

    assert!(matches!(error, Error::InvalidData(_)));

    let category_count = transaction_categories::table
        .count()
        .get_result::<i64>(&mut get_connection(repo.pool()).expect("connection"))
        .expect("category count");
    assert_eq!(category_count, 0);
}

#[tokio::test]
async fn duplicate_retry_does_not_block_domain_mutation_in_same_transaction() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    repo.insert(sample_alert("budget.status", "shared-occurrence"))
        .await
        .expect("seed alert");

    let category_id = "7c9e6679-7425-40de-944b-e07fc1f90ae7".to_string();
    let duplicate_alert = sample_alert("budget.status", "shared-occurrence");

    repo.writer()
        .exec(move |conn| {
            diesel::insert_into(transaction_categories::table)
                .values((
                    transaction_categories::id.eq(&category_id),
                    transaction_categories::name.eq("Food"),
                    transaction_categories::role.eq("spending"),
                    transaction_categories::created_at.eq(Utc::now().naive_utc()),
                    transaction_categories::updated_at.eq(Utc::now().naive_utc()),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            let outcome = insert_domain_alert(conn, &duplicate_alert)?;
            assert_eq!(outcome, AlertInsertOutcome::AlreadyExists);
            Ok(CommittedOutcome::new(category_id.clone(), outcome))
        })
        .await
        .expect("combined mutation");

    let category_count = transaction_categories::table
        .count()
        .get_result::<i64>(&mut get_connection(repo.pool()).expect("connection"))
        .expect("category count");
    assert_eq!(category_count, 1);
}

#[tokio::test]
async fn privacy_safe_failures_omit_alert_and_financial_content() {
    let temp_db = TempDb::new();
    let repo = setup(&temp_db);
    let sentinel_title = "SENTINEL_TITLE_SECRET";
    let sentinel_body = "SENTINEL_BODY_SECRET";
    let sentinel_key = "SENTINEL_OCCURRENCE_KEY";
    let invalid_alert = NewDomainAlert {
        title: sentinel_title.to_string(),
        body: sentinel_body.to_string(),
        occurrence_key: sentinel_key.to_string(),
        destination: Some(DomainAlertDestination::Budget {
            budget_id: "not-a-uuid".to_string(),
        }),
        ..sample_alert("budget.status", sentinel_key)
    };

    let error = repo.insert(invalid_alert).await.expect_err("invalid alert");
    let message = error.to_string();

    for secret in [
        sentinel_title,
        sentinel_body,
        sentinel_key,
        "not-a-uuid",
        "SENTINEL",
    ] {
        assert!(
            !message.contains(secret),
            "error leaked sensitive content: {message}"
        );
    }
}

#[test]
fn canonical_traversal_query_uses_index() {
    let temp_db = TempDb::new();
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");

    let plan = explain_plan(
        &mut connection,
        "EXPLAIN QUERY PLAN \
         SELECT * FROM domain_alerts \
         ORDER BY created_at DESC, id DESC \
         LIMIT 50",
    );

    assert!(
        plan.iter().any(|row| row
            .detail
            .contains("domain_alerts_canonical_traversal_index")),
        "expected canonical traversal index in query plan: {plan:?}"
    );
}

#[test]
fn unread_count_query_uses_partial_index() {
    let temp_db = TempDb::new();
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
    let pool = Pool::builder().build(manager).expect("pool");
    run_migrations(&pool).expect("migrations");
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("connect");

    let plan = explain_plan(
        &mut connection,
        "EXPLAIN QUERY PLAN SELECT COUNT(*) FROM domain_alerts WHERE read_at IS NULL",
    );

    assert!(
        plan.iter()
            .any(|row| row.detail.contains("domain_alerts_unread_lookup_index")),
        "expected unread lookup index in query plan: {plan:?}"
    );
}
