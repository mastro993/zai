use chrono::{NaiveDateTime, Utc};
use diesel::connection::SimpleConnection;
use diesel::prelude::*;
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
use zai_core::money::CurrencyCode;
use zai_db::connect;
use zai_db::currency::require_setup_on_connection;

const REFERENCE_SEED: u64 = 377;
const TXN_COUNT: usize = 10_000;
const RESTATEMENT_TARGET: &str = "RUB";
const IMPORT_ROWS: usize = 1_000;

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

    // Use a dedicated connection for bulk inserts + restatement. The repository uses its own writer,
    // but SQLite will serialize writes anyway.
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
    restate_default_currency(valuations.as_ref()).await?;
    let restatement_elapsed = restatement_start.elapsed();
    if restatement_elapsed > Duration::from_secs(60) {
        return Err(io::Error::other(format!(
            "restatement exceeded 60 seconds: {}ms",
            restatement_elapsed.as_millis()
        ))
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

    let restatement_elapsed_ms = restatement_elapsed.as_millis() as u64;
    let import_elapsed_ms = import_elapsed.as_millis() as u64;

    println!(
        "processed_transactions={}; restatement_elapsed_ms={}; import_rows={}; import_elapsed_ms={}; seed={}",
        TXN_COUNT, restatement_elapsed_ms, IMPORT_ROWS, import_elapsed_ms, REFERENCE_SEED
    );

    Ok(())
}

fn seed_transactions_and_rates(conn: &mut SqliteConnection) -> Result<(), Box<dyn Error>> {
    let tx_date = "2026-01-15 00:00:00";

    // Deterministic, replayable seed.
    let mut seed = REFERENCE_SEED;
    let mut is_eur = Vec::with_capacity(TXN_COUNT);
    let mut amounts: Vec<i32> = Vec::with_capacity(TXN_COUNT);

    for _ in 0..TXN_COUNT {
        seed = next_seed(seed);
        let eur = seed.is_multiple_of(2);
        seed = next_seed(seed);
        let amount: i32 = 10_000 + (seed % 90_000) as i32;
        is_eur.push(eur);
        amounts.push(amount);
    }

    const BATCH: usize = 250;

    // Insert transactions (no valuations yet; restatement will rebuild them).
    for (batch_idx, batch) in is_eur.chunks(BATCH).enumerate() {
        let start_idx = batch_idx * BATCH;
        let mut tuples = Vec::with_capacity(batch.len());

        for (offset, &is_eur_txn) in batch.iter().enumerate() {
            let i = start_idx + offset;
            let tx_id = format!("bench377-txn-{i}");
            let currency = if is_eur_txn { "EUR" } else { "RUB" };
            let amount = amounts[i];
            tuples.push(format!(
                "('{id}', NULL, {amount}, '{currency}', '{tx_date}', 'expense', NULL, NULL)",
                id = tx_id,
                amount = amount,
                currency = currency,
                tx_date = tx_date,
            ));
        }

        let sql = format!(
            "INSERT INTO transactions (id, description, amount, currency, transaction_date, transaction_type, transaction_category_id, notes) \
             VALUES {}",
            tuples.join(",")
        );
        diesel::sql_query(&sql).execute(conn)?;
    }

    // Insert manual exchange-rate revisions (interpreted at valuation time).
    for (batch_idx, batch) in is_eur.chunks(BATCH).enumerate() {
        let start_idx = batch_idx * BATCH;
        let mut tuples = Vec::with_capacity(batch.len());

        for (offset, &is_eur_txn) in batch.iter().enumerate() {
            let i = start_idx + offset;
            let tx_id = format!("bench377-txn-{i}");
            let rate_id = format!("bench377-txrate-{i}");
            let (decimal, coefficient) = if is_eur_txn {
                ("90", 90_i64)
            } else {
                ("1", 1_i64)
            };

            tuples.push(format!(
                "('{rate_id}', '{tx_id}', 1, 'manual', NULL, '{decimal}', {coefficient}, 0, 1, CURRENT_TIMESTAMP)",
                rate_id = rate_id,
                tx_id = tx_id,
                decimal = decimal,
                coefficient = coefficient,
            ));
        }

        let sql = format!(
            "INSERT INTO transaction_exchange_rate_revisions (\
                id, transaction_id, sequence, variant, rate_date, original_decimal, coefficient, scale, formula_version, created_at\
            ) VALUES {}",
            tuples.join(",")
        );
        diesel::sql_query(&sql).execute(conn)?;
    }

    Ok(())
}

async fn restate_default_currency(
    valuations: &zai_db::valuations::ValuationsRepository,
) -> Result<(), Box<dyn Error>> {
    let target = CurrencyCode::parse(RESTATEMENT_TARGET)?;
    let now = Utc::now().naive_utc();
    let _active = valuations.change_default_currency(target, now).await?;
    Ok(())
}

async fn bound_import_with_currency_preparation(
    repository: &zai_db::transactions::TransactionsRepository,
) -> Result<(), Box<dyn Error>> {
    let mut seed = REFERENCE_SEED.wrapping_add(1);
    let import_date = NaiveDateTime::parse_from_str("2026-02-01 00:00:00", "%Y-%m-%d %H:%M:%S")?;

    let mut rows: Vec<BoundImportCommitRow> = Vec::with_capacity(IMPORT_ROWS);
    for i in 0..IMPORT_ROWS {
        seed = next_seed(seed);
        let currency = if seed.is_multiple_of(2) { "EUR" } else { "RUB" }.to_string();
        seed = next_seed(seed);
        let amount: i32 = 5_000 + (seed % 45_000) as i32;

        let decimal = if currency == "EUR" {
            "90".to_string()
        } else {
            "1".to_string()
        };
        let transaction = NewTransaction {
            id: Some(format!("bench377-import-txn-{i}")),
            description: None,
            amount,
            currency,
            transaction_date: import_date,
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
            manual_exchange_rate: None,
        };

        rows.push(BoundImportCommitRow {
            transaction,
            rate_plan: ImportRatePlan::Manual {
                decimal,
                rate_date: None,
            },
        });
    }

    let request = BoundImportCommitRequest {
        enable_currencies: vec!["RUB".to_string()],
        categories: vec![],
        rows,
    };

    // Any provider-heavy path is avoided by using RUB (not an approved ECB currency).
    repository.commit_bound_import(request).await?;
    Ok(())
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
