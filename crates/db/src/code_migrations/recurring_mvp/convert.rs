use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{Integer, Nullable, Text, Timestamp};
use diesel::sqlite::SqliteConnection;
use zai_core::time::{IanaZone, resolve_local_datetime_to_utc};
use zai_core::{DatabaseError, Error, Result};

pub(super) fn query_failed(err: impl std::fmt::Display) -> Error {
    Error::Database(DatabaseError::QueryFailed(err.to_string()))
}

#[derive(QueryableByName)]
struct LegacyTransactionRow {
    #[diesel(sql_type = Text)]
    id: String,
    #[diesel(sql_type = Nullable<Text>)]
    description: Option<String>,
    #[diesel(sql_type = Integer)]
    amount: i32,
    #[diesel(sql_type = Timestamp)]
    transaction_date: NaiveDateTime,
    #[diesel(sql_type = Text)]
    transaction_type: String,
    #[diesel(sql_type = Nullable<Text>)]
    transaction_category_id: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    notes: Option<String>,
    #[diesel(sql_type = Timestamp)]
    created_at: NaiveDateTime,
    #[diesel(sql_type = Timestamp)]
    updated_at: NaiveDateTime,
    #[diesel(sql_type = Nullable<Timestamp>)]
    deleted_at: Option<NaiveDateTime>,
}

pub(super) fn copy_transactions(conn: &mut SqliteConnection, zone: &IanaZone) -> Result<()> {
    let rows: Vec<LegacyTransactionRow> = sql_query(
        "SELECT id, description, amount, transaction_date, transaction_type,
                transaction_category_id, notes, created_at, updated_at, deleted_at
         FROM transactions_old",
    )
    .load(conn)
    .map_err(query_failed)?;

    for row in rows {
        let utc = resolve_local_datetime_to_utc(row.transaction_date, zone)?.naive_utc();
        sql_query(
            "INSERT INTO transactions (
                id, description, amount, transaction_date, transaction_type,
                transaction_category_id, notes, created_at, updated_at, deleted_at, time_zone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind::<Text, _>(&row.id)
        .bind::<Nullable<Text>, _>(row.description.as_deref())
        .bind::<Integer, _>(row.amount)
        .bind::<Timestamp, _>(utc)
        .bind::<Text, _>(&row.transaction_type)
        .bind::<Nullable<Text>, _>(row.transaction_category_id.as_deref())
        .bind::<Nullable<Text>, _>(row.notes.as_deref())
        .bind::<Timestamp, _>(row.created_at)
        .bind::<Timestamp, _>(row.updated_at)
        .bind::<Nullable<Timestamp>, _>(row.deleted_at)
        .bind::<Text, _>(zone.name())
        .execute(conn)
        .map_err(query_failed)?;
    }
    Ok(())
}

pub(super) fn copy_budgets(conn: &mut SqliteConnection, zone: &IanaZone) -> Result<()> {
    sql_query(
        "INSERT INTO budgets (
            id, name, cadence, measurement_mode, base_allowance, rollover_mode,
            warning_percentage, created_at, updated_at, deleted_at, revision, paused, time_zone
        )
        SELECT
            id, name, cadence, measurement_mode, base_allowance, rollover_mode,
            warning_percentage, created_at, updated_at, deleted_at, revision, paused, ?
        FROM budgets_old",
    )
    .bind::<Text, _>(zone.name())
    .execute(conn)
    .map_err(query_failed)?;
    Ok(())
}

// period_end is recomputed half-open from cadence + start because released
// schemas stored closed '23:59:59' period ends.
const PERIOD_END_FROM_CADENCE: &str = "
    CASE b.cadence
        WHEN 'day' THEN date(o.period_start, '+1 day')
        WHEN 'week' THEN date(o.period_start, '+7 days')
        WHEN 'month' THEN date(o.period_start, '+1 month')
        WHEN 'year' THEN date(o.period_start, '+1 year')
    END
";

pub(super) fn copy_budget_periods(conn: &mut SqliteConnection) -> Result<()> {
    sql_query(format!(
        "INSERT INTO budget_configurations (
            budget_id, period_start, period_end, category_ids, base_allowance,
            measurement_mode, rollover_mode, warning_percentage
        )
        SELECT
            o.budget_id, date(o.period_start), {PERIOD_END_FROM_CADENCE},
            o.category_ids, o.base_allowance, o.measurement_mode, o.rollover_mode,
            o.warning_percentage
        FROM budget_configurations_old o
        JOIN budgets b ON b.id = o.budget_id"
    ))
    .execute(conn)
    .map_err(query_failed)?;

    sql_query(format!(
        "INSERT INTO budget_period_results (
            budget_id, period_start, period_end, net_budget_spending,
            effective_allowance, remaining_allowance, status
        )
        SELECT
            o.budget_id, date(o.period_start), {PERIOD_END_FROM_CADENCE},
            o.net_budget_spending, o.effective_allowance, o.remaining_allowance, o.status
        FROM budget_period_results_old o
        JOIN budgets b ON b.id = o.budget_id"
    ))
    .execute(conn)
    .map_err(query_failed)?;
    Ok(())
}

pub(super) fn copy_domain_alerts(conn: &mut SqliteConnection) -> Result<()> {
    sql_query(
        "INSERT INTO domain_alerts (
            id, producer_key, occurrence_key, severity, title, body, destination,
            data, created_at, read_at, updated_at, resolved_at
        )
        SELECT
            id, producer_key, occurrence_key, severity, title, body, destination,
            data, created_at, read_at, created_at, NULL
        FROM domain_alerts_old",
    )
    .execute(conn)
    .map_err(query_failed)?;
    Ok(())
}

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    count: i64,
}

#[derive(QueryableByName)]
struct QuickCheckRow {
    #[diesel(sql_type = Text)]
    quick_check: String,
}

pub(super) fn run_integrity_checks(conn: &mut SqliteConnection) -> Result<()> {
    let fk_violations: CountRow =
        sql_query("SELECT COUNT(*) AS count FROM pragma_foreign_key_check")
            .get_result(conn)
            .map_err(query_failed)?;
    if fk_violations.count != 0 {
        return Err(Error::Database(DatabaseError::MigrationFailed(
            "Foreign key check failed after recurring schema migration".to_string(),
        )));
    }

    let quick_check: QuickCheckRow = sql_query("PRAGMA quick_check")
        .get_result(conn)
        .map_err(query_failed)?;
    if quick_check.quick_check != "ok" {
        return Err(Error::Database(DatabaseError::MigrationFailed(
            "Quick check failed after recurring schema migration".to_string(),
        )));
    }
    Ok(())
}
