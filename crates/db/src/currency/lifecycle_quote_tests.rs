use super::lifecycle::prove_coverage;
use super::quote_on;
use crate::connection::{create_pool, get_connection, run_migrations};
use crate::exchange_rates::ExchangeRateRepository;
use crate::test_utils::TempDb;
use crate::write_actor::spawn_writer;
use chrono::{TimeZone, Utc};
use zai_core::features::currency::QuoteVariant;
use zai_core::features::exchange_rates::{
    APPROVED_ECB_CURRENCIES, ExchangeRateCache, SyncMetadata, parse_ecb_csv, validate_complete_set,
};
use zai_core::money::CurrencyCode;

fn jpy_csv() -> String {
    let mut body = String::from("CURRENCY,TIME_PERIOD,OBS_VALUE\n");
    for code in APPROVED_ECB_CURRENCIES {
        let value = if *code == "JPY" { "186.5" } else { "1.25" };
        body.push_str(&format!("{code},2026-08-17,{value}\n"));
    }
    body
}

#[tokio::test]
async fn quote_on_yen_to_euro_keeps_sub_cent_rate() {
    let temp_db = TempDb::new();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let repo = ExchangeRateRepository::new(pool.clone(), writer);
    let parsed = parse_ecb_csv(&jpy_csv()).expect("parse");
    let set = validate_complete_set(&parsed, None, "set-jpy".to_string()).expect("set");
    repo.publish(
        set,
        SyncMetadata {
            updated_after: None,
            etag: None,
        },
        Utc.with_ymd_and_hms(2026, 8, 18, 12, 0, 0).unwrap(),
    )
    .await
    .expect("publish");

    let mut connection = get_connection(&pool).expect("conn");
    let quote = quote_on(
        &mut connection,
        CurrencyCode::parse("JPY").expect("JPY"),
        CurrencyCode::parse("EUR").expect("EUR"),
        chrono::NaiveDate::from_ymd_opt(2026, 8, 17).expect("date"),
        "2026-08-17",
    )
    .expect("quote");

    assert_eq!(quote.variant, QuoteVariant::Automatic);
    let rate = quote.rate.expect("rate");
    assert_ne!(rate, "0.01");
    assert!(rate.starts_with("0.00536193"), "{rate}");
}

async fn publish_csv(days: i64) -> (std::sync::Arc<crate::connection::DbPool>, TempDb) {
    use chrono::NaiveDate;

    let temp_db = TempDb::new();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
    let repo = ExchangeRateRepository::new(pool.clone(), writer);
    let start = NaiveDate::from_ymd_opt(2026, 1, 5).expect("start");
    let mut body = String::from("CURRENCY,TIME_PERIOD,OBS_VALUE\n");
    for offset in 0..days {
        let date = start
            .checked_add_signed(chrono::Duration::days(offset))
            .expect("date");
        for code in APPROVED_ECB_CURRENCIES {
            let value = if *code == "JPY" { "186.5" } else { "1.25" };
            body.push_str(&format!("{code},{date},{value}\n"));
        }
    }
    let parsed = parse_ecb_csv(&body).expect("parse");
    let set = validate_complete_set(&parsed, None, format!("set-{days}")).expect("set");
    repo.publish(
        set,
        SyncMetadata {
            updated_after: None,
            etag: None,
        },
        Utc.with_ymd_and_hms(2026, 8, 18, 12, 0, 0).unwrap(),
    )
    .await
    .expect("publish");
    (pool, temp_db)
}

#[tokio::test]
async fn quote_statement_count_does_not_grow_with_history() {
    use crate::sql_statement_counter::ConnectionStatementCounter;

    let quote_count = async |days: i64| {
        let (pool, _temp) = publish_csv(days).await;
        let mut connection = get_connection(&pool).expect("conn");
        let counter = ConnectionStatementCounter::install(&mut connection);
        let quote = quote_on(
            &mut connection,
            CurrencyCode::parse("JPY").expect("JPY"),
            CurrencyCode::parse("EUR").expect("EUR"),
            chrono::NaiveDate::from_ymd_opt(2026, 1, 5).expect("date"),
            "2026-01-05",
        )
        .expect("quote");
        assert_eq!(quote.variant, QuoteVariant::Automatic);
        (counter.count(), _temp)
    };

    let (small, _keep_small) = quote_count(5).await;
    let (large, _keep_large) = quote_count(80).await;
    assert!(
        small <= 8,
        "indexed quote should be a handful of statements, got {small}"
    );
    assert_eq!(small, large, "quote must not scan every stored observation");
}

#[test]
fn prove_coverage_rejects_catalog_currency_without_ecb_series() {
    let temp_db = TempDb::new();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    let error = prove_coverage(&pool, "AED").expect_err("AED has no ECB series");
    assert!(
        matches!(error, zai_core::Error::IncompleteCoverage { .. }),
        "{error:?}"
    );
}

#[test]
fn prove_coverage_rejects_usd_when_ecb_history_is_missing() {
    let temp_db = TempDb::new();
    let pool = create_pool(std::path::Path::new(temp_db.path())).expect("pool");
    run_migrations(&pool).expect("migrations");
    let error = prove_coverage(&pool, "USD").expect_err("USD needs an accepted ECB set");
    assert!(
        matches!(error, zai_core::Error::IncompleteCoverage { .. }),
        "{error:?}"
    );
}
