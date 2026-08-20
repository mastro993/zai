use crate::connection::{DbPool, get_connection};
use crate::errors::IntoCore;
use chrono::Utc;
use diesel::RunQueryDsl;
use diesel::prelude::QueryableByName;
use diesel::sql_query;
use diesel::sql_types::{Integer, Nullable, Text, Timestamp};
use std::time::Duration;
use zai_core::features::currency::{
    CurrencyJob, CurrencyJobRecord, CurrencyJobStatus, CurrencyJobType,
};
use zai_core::{DatabaseError, Error, ErrorCode, ErrorEnvelope, Result};

const JOB_WRITE_RETRY_DELAYS: [Duration; 3] = [
    Duration::from_millis(25),
    Duration::from_millis(50),
    Duration::from_millis(100),
];

#[derive(QueryableByName)]
struct JobRow {
    #[diesel(sql_type = Text)]
    id: String,
    #[diesel(sql_type = Text)]
    job_type: String,
    #[diesel(sql_type = Text)]
    status: String,
    #[diesel(sql_type = Nullable<Text>)]
    currency_code: Option<String>,
    #[diesel(sql_type = Integer)]
    stage_current: i32,
    #[diesel(sql_type = Integer)]
    stage_total: i32,
    #[diesel(sql_type = Nullable<Text>)]
    error_code: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    error_message: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    generation_id: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    error_details: Option<String>,
}

pub fn insert_job(pool: &DbPool, job: &CurrencyJob) -> Result<()> {
    retry_busy(|| {
        let mut connection = get_connection(pool)?;
        let now = Utc::now().naive_utc();
        let (error_code, error_message, error_details) = job_error_columns(job);
        sql_query(
            "INSERT INTO currency_jobs (\
                id, job_type, status, currency_code, stage_current, stage_total, \
                error_code, error_message, error_details, created_at, updated_at\
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind::<Text, _>(&job.job_id)
        .bind::<Text, _>(job_type_wire(job.job_type))
        .bind::<Text, _>(job_status_wire(job.status))
        .bind::<Nullable<Text>, _>(job.currency_code.as_deref())
        .bind::<Integer, _>(i32::try_from(job.stage_current).unwrap_or(0))
        .bind::<Integer, _>(i32::try_from(job.stage_total).unwrap_or(0))
        .bind::<Nullable<Text>, _>(error_code)
        .bind::<Nullable<Text>, _>(error_message)
        .bind::<Nullable<Text>, _>(error_details)
        .bind::<Timestamp, _>(now)
        .bind::<Timestamp, _>(now)
        .execute(&mut connection)
        .map_err(|error| match crate::errors::StorageError::from(error) {
            crate::errors::StorageError::QueryFailed(diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                _,
            )) => Error::CurrencyJobConflict,
            other => Error::from(other),
        })?;
        Ok(())
    })
}

pub fn update_job(pool: &DbPool, job: &CurrencyJob) -> Result<()> {
    retry_busy(|| {
        let mut connection = get_connection(pool)?;
        let now = Utc::now().naive_utc();
        let (error_code, error_message, error_details) = job_error_columns(job);
        sql_query(
            "UPDATE currency_jobs SET status = ?, stage_current = ?, stage_total = ?, \
             currency_code = ?, error_code = ?, error_message = ?, error_details = ?, updated_at = ? \
             WHERE id = ?",
        )
        .bind::<Text, _>(job_status_wire(job.status))
        .bind::<Integer, _>(i32::try_from(job.stage_current).unwrap_or(0))
        .bind::<Integer, _>(i32::try_from(job.stage_total).unwrap_or(0))
        .bind::<Nullable<Text>, _>(job.currency_code.as_deref())
        .bind::<Nullable<Text>, _>(error_code)
        .bind::<Nullable<Text>, _>(error_message)
        .bind::<Nullable<Text>, _>(error_details)
        .bind::<Timestamp, _>(now)
        .bind::<Text, _>(&job.job_id)
        .execute(&mut connection)
        .into_core()?;
        Ok(())
    })
}

pub fn get_job(pool: &DbPool, job_id: &str) -> Result<Option<CurrencyJobRecord>> {
    let mut connection = get_connection(pool)?;
    let rows = sql_query(
        "SELECT id, job_type, status, currency_code, stage_current, stage_total, \
         error_code, error_message, error_details, generation_id FROM currency_jobs WHERE id = ?",
    )
    .bind::<Text, _>(job_id)
    .load::<JobRow>(&mut connection)
    .into_core()?;
    rows.into_iter().next().map(job_from_row).transpose()
}

pub fn running_job(pool: &DbPool) -> Result<Option<CurrencyJobRecord>> {
    let mut connection = get_connection(pool)?;
    let rows = sql_query(
        "SELECT id, job_type, status, currency_code, stage_current, stage_total, \
         error_code, error_message, error_details, generation_id FROM currency_jobs WHERE status = 'running' LIMIT 1",
    )
    .load::<JobRow>(&mut connection)
    .into_core()?;
    rows.into_iter().next().map(job_from_row).transpose()
}

pub fn latest_job(pool: &DbPool) -> Result<Option<CurrencyJobRecord>> {
    let mut connection = get_connection(pool)?;
    let rows = sql_query(
        "SELECT id, job_type, status, currency_code, stage_current, stage_total, \
         error_code, error_message, error_details, generation_id FROM currency_jobs ORDER BY created_at DESC, id DESC LIMIT 1",
    )
    .load::<JobRow>(&mut connection)
    .into_core()?;
    rows.into_iter().next().map(job_from_row).transpose()
}

fn job_from_row(row: JobRow) -> Result<CurrencyJobRecord> {
    Ok(CurrencyJobRecord {
        generation_id: row.generation_id,
        job: CurrencyJob {
            job_id: row.id,
            job_type: parse_job_type(&row.job_type)?,
            status: parse_job_status(&row.status)?,
            stage_current: u32::try_from(row.stage_current).unwrap_or(0),
            stage_total: u32::try_from(row.stage_total).unwrap_or(0),
            currency_code: row.currency_code,
            error: match (row.error_code, row.error_message) {
                (Some(code), Some(message)) => Some(ErrorEnvelope {
                    code: parse_error_code(&code),
                    message,
                    details: row
                        .error_details
                        .and_then(|raw| serde_json::from_str(&raw).ok()),
                }),
                _ => None,
            },
        },
    })
}

fn job_error_columns(job: &CurrencyJob) -> (Option<String>, Option<String>, Option<String>) {
    job.error
        .as_ref()
        .map(|error| {
            (
                Some(error_code_wire(error.code)),
                Some(error.message.clone()),
                error
                    .details
                    .as_ref()
                    .and_then(|value| serde_json::to_string(value).ok()),
            )
        })
        .unwrap_or((None, None, None))
}

fn job_type_wire(job_type: CurrencyJobType) -> &'static str {
    match job_type {
        CurrencyJobType::Setup => "setup",
        CurrencyJobType::AddCurrency => "addCurrency",
        CurrencyJobType::ChangeDefault => "changeDefault",
        CurrencyJobType::ImportPreview => "importPreview",
    }
}

fn job_status_wire(status: CurrencyJobStatus) -> &'static str {
    match status {
        CurrencyJobStatus::Running => "running",
        CurrencyJobStatus::Succeeded => "succeeded",
        CurrencyJobStatus::Failed => "failed",
        CurrencyJobStatus::Cancelled => "cancelled",
    }
}

fn parse_job_type(value: &str) -> Result<CurrencyJobType> {
    match value {
        "setup" => Ok(CurrencyJobType::Setup),
        "addCurrency" => Ok(CurrencyJobType::AddCurrency),
        "changeDefault" => Ok(CurrencyJobType::ChangeDefault),
        "importPreview" => Ok(CurrencyJobType::ImportPreview),
        other => Err(Error::InvalidData(format!(
            "Unknown currency job type: {other}"
        ))),
    }
}

fn parse_job_status(value: &str) -> Result<CurrencyJobStatus> {
    match value {
        "running" => Ok(CurrencyJobStatus::Running),
        "succeeded" => Ok(CurrencyJobStatus::Succeeded),
        "failed" => Ok(CurrencyJobStatus::Failed),
        "cancelled" => Ok(CurrencyJobStatus::Cancelled),
        other => Err(Error::InvalidData(format!(
            "Unknown currency job status: {other}"
        ))),
    }
}

fn error_code_wire(code: ErrorCode) -> String {
    serde_json::to_value(code)
        .ok()
        .and_then(|value| value.as_str().map(ToOwned::to_owned))
        .unwrap_or_else(|| "internal".to_string())
}

fn parse_error_code(value: &str) -> ErrorCode {
    serde_json::from_value(serde_json::Value::String(value.to_string()))
        .unwrap_or(ErrorCode::Internal)
}

fn retry_busy<T>(mut operation: impl FnMut() -> Result<T>) -> Result<T> {
    for delay in JOB_WRITE_RETRY_DELAYS {
        match operation() {
            Err(Error::Database(DatabaseError::Busy)) => std::thread::sleep(delay),
            result => return result,
        }
    }
    operation()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_busy_retries_transient_contention() {
        let mut attempts = 0;
        retry_busy(|| {
            attempts += 1;
            if attempts == 1 {
                Err(Error::Database(DatabaseError::Busy))
            } else {
                Ok(())
            }
        })
        .expect("retry should succeed");

        assert_eq!(attempts, 2);
    }
}
