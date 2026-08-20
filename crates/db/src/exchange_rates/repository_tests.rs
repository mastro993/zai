use chrono::{TimeZone, Utc};
use diesel::prelude::*;
use diesel::sql_query;
use zai_core::features::exchange_rates::{
    APPROVED_ECB_CURRENCIES, ExchangeRateCache, FailureClass, SyncMetadata, parse_ecb_csv,
    validate_complete_set,
};

use super::ExchangeRateRepository;
use crate::connection::{create_pool, run_migrations};
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;

fn complete_csv() -> String {
    let mut body = String::from("CURRENCY,TIME_PERIOD,OBS_VALUE\n");
    for code in APPROVED_ECB_CURRENCIES {
        body.push_str(&format!("{code},2026-08-17,1.25\n"));
    }
    body
}

fn accepted_set(id: &str) -> zai_core::features::exchange_rates::AcceptedRateSet {
    let parsed = parse_ecb_csv(&complete_csv()).expect("parse");
    validate_complete_set(&parsed, None, id.to_string()).expect("set")
}

fn setup() -> (TempDb, ExchangeRateRepository) {
    let temp_db = TempDb::new();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    (temp_db, ExchangeRateRepository::new(pool, writer))
}

#[tokio::test]
async fn publish_switches_head_atomically_and_reads_cache_first() {
    let (_temp, repo) = setup();
    assert!(repo.current_set().await.unwrap().is_none());
    let set = accepted_set("set-a");
    repo.publish(
        set.clone(),
        SyncMetadata {
            updated_after: Some("2026-08-17T16:00:00+02:00".to_string()),
            etag: Some("etag-a".to_string()),
        },
        Utc.with_ymd_and_hms(2026, 8, 18, 12, 0, 0).unwrap(),
    )
    .await
    .expect("publish");
    let loaded = repo.current_set().await.unwrap().expect("head");
    assert_eq!(loaded.id, "set-a");
    assert_eq!(loaded.payload_digest, set.payload_digest);
    assert_eq!(loaded.observations.len(), APPROVED_ECB_CURRENCIES.len());
    let metadata = repo.sync_metadata().await.unwrap();
    assert_eq!(metadata.etag.as_deref(), Some("etag-a"));
    let usd = repo
        .observation(
            zai_core::money::CurrencyCode::parse("USD").unwrap(),
            chrono::NaiveDate::from_ymd_opt(2026, 8, 17).unwrap(),
        )
        .await
        .unwrap()
        .expect("usd");
    assert_eq!(usd.rate.original_decimal(), "1.25");
}

#[tokio::test]
async fn failed_refresh_preserves_last_known_good_head() {
    let (_temp, repo) = setup();
    let first = accepted_set("set-good");
    repo.publish(
        first.clone(),
        SyncMetadata {
            updated_after: None,
            etag: None,
        },
        Utc.with_ymd_and_hms(2026, 8, 18, 12, 0, 0).unwrap(),
    )
    .await
    .expect("publish");
    repo.record_failure(
        FailureClass::Transport,
        Utc.with_ymd_and_hms(2026, 8, 18, 12, 1, 0).unwrap(),
    )
    .await
    .expect("failure");
    let loaded = repo.current_set().await.unwrap().expect("kept");
    assert_eq!(loaded.id, "set-good");
    assert_eq!(loaded.payload_digest, first.payload_digest);
}

#[tokio::test]
async fn not_modified_clears_failure_and_keeps_head() {
    let (temp_db, repo) = setup();
    let first = accepted_set("set-good");
    repo.publish(
        first.clone(),
        SyncMetadata {
            updated_after: Some("2026-08-20T15:14:56Z".to_string()),
            etag: None,
        },
        Utc.with_ymd_and_hms(2026, 8, 20, 15, 14, 56).unwrap(),
    )
    .await
    .expect("publish");
    repo.record_failure(
        FailureClass::HttpStatus,
        Utc.with_ymd_and_hms(2026, 8, 20, 16, 3, 0).unwrap(),
    )
    .await
    .expect("failure");
    repo.record_not_modified(Utc.with_ymd_and_hms(2026, 8, 20, 16, 4, 0).unwrap())
        .await
        .expect("not modified");
    let loaded = repo.current_set().await.unwrap().expect("kept");
    assert_eq!(loaded.id, "set-good");
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("conn");
    #[derive(QueryableByName)]
    struct FailureRow {
        #[diesel(sql_type = diesel::sql_types::Nullable<diesel::sql_types::Text>)]
        failure_class: Option<String>,
        #[diesel(sql_type = diesel::sql_types::Integer)]
        retry_count: i32,
    }
    let row =
        sql_query("SELECT failure_class, retry_count FROM provider_refresh_state WHERE id = 1")
            .get_result::<FailureRow>(&mut connection)
            .expect("row");
    assert_eq!(row.failure_class, None);
    assert_eq!(row.retry_count, 0);
}

#[tokio::test]
async fn accepted_sets_and_observations_are_immutable() {
    let (temp_db, repo) = setup();
    repo.publish(
        accepted_set("set-imm"),
        SyncMetadata {
            updated_after: None,
            etag: None,
        },
        Utc.with_ymd_and_hms(2026, 8, 18, 12, 0, 0).unwrap(),
    )
    .await
    .expect("publish");
    let mut connection = SqliteConnection::establish(temp_db.path()).expect("conn");
    let update_set =
        sql_query("UPDATE provider_rate_sets SET payload_digest = 'tampered' WHERE id = 'set-imm'")
            .execute(&mut connection);
    assert!(update_set.is_err());
    let delete_obs = sql_query("DELETE FROM provider_rate_observations").execute(&mut connection);
    assert!(delete_obs.is_err());
}
