use chrono::{NaiveDateTime, Utc};
use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sqlite::SqliteConnection;
use std::env;
use std::error::Error;
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use zai_core::features::transactions::import_models::{
    BoundImportCommitRequest, BoundImportCommitRow, ImportRatePlan,
};
use zai_core::features::transactions::models::NewTransaction;
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;
use zai_core::money::{CONVERSION_FORMULA_VERSION, CurrencyCode};
use zai_db::connect;
use zai_db::currency::require_setup_on_connection;

const REFERENCE_SEED: u64 = 377;
const TXN_COUNT: usize = 10_000;
const RESTATEMENT_TARGET: &str = "RUB";
const IMPORT_ROWS: usize = 1_000;

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = BigInt)]
    count: i64,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let data_dir = temporary_data_dir()?;
    fs::create_dir_all(&data_dir)?;
    let result = run_benchmark(&data_dir).await;
    let cleanup_result = fs::remove_dir_all(&data_dir);
    match (result, cleanup_result) {
        (Ok(()), Ok(())) => Ok(()),
        (Err(error), _) => Err(error),
        (Ok(()), Err(error)) => Err(error.into()),
    }
}

async fn run_benchmark(data_dir: &Path) -> Result<(), Box<dyn Error>> {
    let database = connect(data_dir)?;
    let repository = database.transactions_repository();
    let valuations = database.valuations_repository();

    let mut conn = SqliteConnection::establish(database.path().to_string_lossy().as_ref())?;
    conn.batch_execute(
        "\
        PRAGMA journal_mode = WAL;\
        PRAGMA foreign_keys = ON;\
        PRAGMA busy_timeout = 30000;\
        PRAGMA synchronous = NORMAL;\
        ",
    )?;

    require_setup_on_connection(&mut conn)?;
    seed_transactions_and_rates(&mut conn)?;

    wait_for_measurement_start()?;

    let restatement_start = Instant::now();
    let target = CurrencyCode::parse(RESTATEMENT_TARGET)?;
    let active = valuations
        .change_default_currency(target, Utc::now().naive_utc())
        .await?;
    let restatement_elapsed = restatement_start.elapsed();
    if restatement_elapsed > Duration::from_secs(60) {
        return Err(io::Error::other(format!(
            "restatement exceeded 60 seconds: {}ms",
            restatement_elapsed.as_millis()
        ))
        .into());
    }

    let valuation_count = count_query(
        &mut conn,
        &format!(
            "SELECT COUNT(*) AS count FROM transaction_valuations WHERE generation_id = '{}'",
            active.id.replace('\'', "''")
        ),
    )?;
    if valuation_count != TXN_COUNT as i64 {
        return Err(format!(
            "restatement wrote {valuation_count} valuations, expected {TXN_COUNT}"
        )
        .into());
    }

    let import_start = Instant::now();
    bound_import_with_currency_preparation(repository.as_ref()).await?;
    let import_elapsed = import_start.elapsed();
    if import_elapsed > Duration::from_secs(60) {
        return Err(io::Error::other(format!(
            "import exceeded 60 seconds: {}ms",
            import_elapsed.as_millis()
        ))
        .into());
    }

    let transaction_count = count_query(
        &mut conn,
        "SELECT COUNT(*) AS count FROM transactions WHERE deleted_at IS NULL",
    )?;
    if transaction_count != (TXN_COUNT + IMPORT_ROWS) as i64 {
        return Err(format!(
            "persisted {transaction_count} transactions, expected {}",
            TXN_COUNT + IMPORT_ROWS
        )
        .into());
    }

    println!(
        "processed_transactions={}; restatement_elapsed_ms={}; import_rows={}; import_elapsed_ms={}; seed={}",
        TXN_COUNT,
        restatement_elapsed.as_millis(),
        IMPORT_ROWS,
        import_elapsed.as_millis(),
        REFERENCE_SEED
    );

    Ok(())
}

fn seed_transactions_and_rates(conn: &mut SqliteConnection) -> Result<(), Box<dyn Error>> {
    sql_query(
        "INSERT INTO enabled_currencies (code, enabled_at, disabled_at) \
         VALUES ('RUB', CURRENT_TIMESTAMP, NULL)",
    )
    .execute(conn)?;

    let tx_date = "2026-01-15 00:00:00";
    let mut seed = REFERENCE_SEED;
    let mut is_eur = Vec::with_capacity(TXN_COUNT);
    let mut amounts = Vec::with_capacity(TXN_COUNT);

    for _ in 0..TXN_COUNT {
        seed = next_seed(seed);
        let eur = seed.is_multiple_of(2);
        seed = next_seed(seed);
        is_eur.push(eur);
        amounts.push(10_000 + (seed % 90_000) as i32);
    }

    const BATCH: usize = 250;
    for (batch_idx, batch) in is_eur.chunks(BATCH).enumerate() {
        let start_idx = batch_idx * BATCH;
        let mut tuples = Vec::with_capacity(batch.len());
        for (offset, &is_eur_txn) in batch.iter().enumerate() {
            let i = start_idx + offset;
            let currency = if is_eur_txn { "EUR" } else { "RUB" };
            tuples.push(format!(
                "('bench377-txn-{i}', NULL, {amount}, '{currency}', '{tx_date}', 'expense', NULL, NULL, '{tx_date}', '{tx_date}', NULL)",
                amount = amounts[i],
            ));
        }
        sql_query(format!(
            "INSERT INTO transactions (\
                id, description, amount, currency, transaction_date, transaction_type, \
                transaction_category_id, notes, created_at, updated_at, deleted_at\
             ) VALUES {}",
            tuples.join(",")
        ))
        .execute(conn)?;
    }

    for (batch_idx, batch) in is_eur.chunks(BATCH).enumerate() {
        let start_idx = batch_idx * BATCH;
        let mut tuples = Vec::with_capacity(batch.len());
        for (offset, &is_eur_txn) in batch.iter().enumerate() {
            let i = start_idx + offset;
            let variant = if is_eur_txn { "identity" } else { "pending" };
            tuples.push(format!(
                "('bench377-txrate-{i}', 'bench377-txn-{i}', 1, '{variant}', '{tx_date}', NULL, NULL, NULL, {formula}, '{tx_date}')",
                formula = CONVERSION_FORMULA_VERSION,
            ));
        }
        sql_query(format!(
            "INSERT INTO transaction_exchange_rate_revisions (\
                id, transaction_id, sequence, variant, rate_date, original_decimal, \
                coefficient, scale, formula_version, created_at\
             ) VALUES {}",
            tuples.join(",")
        ))
        .execute(conn)?;
    }

    Ok(())
}

async fn bound_import_with_currency_preparation(
    repository: &zai_db::transactions::TransactionsRepository,
) -> Result<(), Box<dyn Error>> {
    let mut seed = REFERENCE_SEED.wrapping_add(1);
    let import_date = NaiveDateTime::parse_from_str("2026-02-01 00:00:00", "%Y-%m-%d %H:%M:%S")?;
    let mut rows = Vec::with_capacity(IMPORT_ROWS);
    for i in 0..IMPORT_ROWS {
        seed = next_seed(seed);
        let currency = if seed.is_multiple_of(2) { "EUR" } else { "RUB" }.to_string();
        seed = next_seed(seed);
        let amount = 5_000 + (seed % 45_000) as i32;
        let rate_plan = if currency == "EUR" {
            ImportRatePlan::Pending {
                rate_date: import_date,
            }
        } else {
            ImportRatePlan::Identity
        };
        rows.push(BoundImportCommitRow {
            transaction: NewTransaction {
                id: Some(format!("bench377-import-txn-{i}")),
                description: None,
                amount,
                currency,
                transaction_date: import_date,
                transaction_type: "expense".to_string(),
                transaction_category_id: None,
                notes: None,
                manual_exchange_rate: None,
            },
            rate_plan,
        });
    }

    repository
        .commit_bound_import(BoundImportCommitRequest {
            enable_currencies: vec!["RUB".to_string()],
            categories: vec![],
            rows,
        })
        .await?;
    Ok(())
}

fn count_query(conn: &mut SqliteConnection, sql: &str) -> Result<i64, Box<dyn Error>> {
    Ok(sql_query(sql).get_result::<CountRow>(conn)?.count)
}

fn next_seed(seed: u64) -> u64 {
    seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1)
}

fn wait_for_measurement_start() -> Result<(), Box<dyn Error>> {
    if env::var_os("ZAI_REFERENCE_RUNNER_WAIT").is_none() {
        return Ok(());
    }
    println!("READY");
    io::stdout().flush()?;
    let stdin = io::stdin();
    let mut line = String::new();
    stdin.lock().read_line(&mut line)?;
    Ok(())
}

fn temporary_data_dir() -> Result<PathBuf, Box<dyn Error>> {
    let suffix = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    Ok(env::temp_dir().join(format!("zai-currency-reference-{suffix}")))
}
