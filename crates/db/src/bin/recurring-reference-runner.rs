use chrono::{Duration, NaiveDateTime};
use std::env;
use std::error::Error;
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use zai_core::features::recurring_transactions::{
    NewRecurringTransaction, ProcessOneOutcome, RecurringTemplateInput,
    RecurringTransactionsRepositoryTrait, ScheduleIntervalUnit, ScheduleRule,
};
use zai_db::connect;

const REFERENCE_SEED: u64 = 220;
const REFERENCE_SOURCE_COUNT: u32 = 100;
const REFERENCE_OCCURRENCES_PER_SOURCE: u32 = 100;
const REFERENCE_OCCURRENCES: u32 = REFERENCE_SOURCE_COUNT * REFERENCE_OCCURRENCES_PER_SOURCE;

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
    let repository = database.recurring_transactions_repository();
    let observed_local = NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S")?;

    let mut seed = REFERENCE_SEED;
    for source_index in 0..REFERENCE_SOURCE_COUNT {
        let id = format!("reference-{REFERENCE_SEED}-{source_index}");
        repository
            .create_recurring_transaction(NewRecurringTransaction {
                id: Some(id),
                schedule: ScheduleRule::Interval {
                    every: 1,
                    unit: ScheduleIntervalUnit::Day,
                },
                first_scheduled_local: observed_local
                    - Duration::days(i64::from(REFERENCE_OCCURRENCES_PER_SOURCE)),
                total_occurrences: Some(REFERENCE_OCCURRENCES_PER_SOURCE as i32),
                template: RecurringTemplateInput {
                    description: format!("Reference runner {source_index}"),
                    amount: 100 + (next_seed(&mut seed) % 900) as i32,
                    transaction_type: "expense".to_string(),
                    transaction_category_id: None,
                    notes: None,
                },
            })
            .await?;
    }

    wait_for_measurement_start()?;
    let started = Instant::now();
    let mut processed = 0_u32;
    loop {
        match repository
            .process_one_due_occurrence(observed_local)
            .await?
        {
            ProcessOneOutcome::Committed(_) | ProcessOneOutcome::AlreadyFulfilled(_) => {
                processed += 1;
            }
            ProcessOneOutcome::GenerationFailed => return Err("reference generation failed".into()),
            ProcessOneOutcome::NoEligibleWork => break,
        }
        if processed > REFERENCE_OCCURRENCES {
            return Err("reference over-fulfilled".into());
        }
    }

    if processed != REFERENCE_OCCURRENCES {
        return Err(
            format!("reference processed {processed}, expected {REFERENCE_OCCURRENCES}").into(),
        );
    }
    for source_index in 0..REFERENCE_SOURCE_COUNT {
        let source = repository
            .get_recurring_transaction(&format!("reference-{REFERENCE_SEED}-{source_index}"))
            .await?;
        if source.fulfilled_count != REFERENCE_OCCURRENCES_PER_SOURCE as i32 {
            return Err(format!("reference source {source_index} was not fully processed").into());
        }
    }
    println!(
        "processed={processed} elapsed_ms={} seed={REFERENCE_SEED}",
        started.elapsed().as_millis()
    );
    drop(database);
    Ok(())
}

fn next_seed(seed: &mut u64) -> u64 {
    *seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
    *seed
}

fn wait_for_measurement_start() -> io::Result<()> {
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
    Ok(env::temp_dir().join(format!("zai-recurring-reference-{suffix}")))
}
