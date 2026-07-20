use super::models::{
    RecurringGenerationFailureRow, RecurringOccurrenceHeadRow, RecurringOccurrenceRow,
    RecurringTransactionRow, build_generation_failure, build_occurrence, build_occurrence_head,
    build_recurring_transaction,
};
use crate::errors::IntoCore;
use crate::schema::{
    recurring_generation_failures, recurring_occurrence_heads, recurring_occurrences,
    recurring_transactions,
};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::features::recurring_transactions::{
    MAX_FAILURE_LIMIT, MAX_FEED_LIMIT, RecurringFailurePage, RecurringFeedPage,
    RecurringGenerationFailure, RecurringOccurrence, RecurringOccurrenceHead,
    RecurringOccurrencePage, RecurringTransaction,
};
use zai_core::{Error, Result};

pub fn normalize_feed_limit(limit: i64) -> Result<i64> {
    if limit < 1 {
        return Err(Error::InvalidData(
            "Feed limit must be at least 1".to_string(),
        ));
    }
    Ok(limit.min(MAX_FEED_LIMIT))
}

pub fn normalize_failure_limit(limit: i64) -> Result<i64> {
    if limit < 1 {
        return Err(Error::InvalidData(
            "Failure history limit must be at least 1".to_string(),
        ));
    }
    Ok(limit.min(MAX_FAILURE_LIMIT))
}

pub fn encode_feed_cursor(updated_at: NaiveDateTime, id: &str) -> String {
    format!("{updated_at}|{id}")
}

pub fn decode_feed_cursor(cursor: &str) -> Result<(NaiveDateTime, String)> {
    let (updated_at, id) = cursor.split_once('|').ok_or_else(|| {
        Error::InvalidData("Feed cursor must be updatedAt|id".to_string())
    })?;
    let updated_at = NaiveDateTime::parse_from_str(updated_at, "%Y-%m-%d %H:%M:%S%.f")
        .or_else(|_| NaiveDateTime::parse_from_str(updated_at, "%Y-%m-%d %H:%M:%S"))
        .map_err(|_| Error::InvalidData("Feed cursor updatedAt is invalid".to_string()))?;
    if id.trim().is_empty() {
        return Err(Error::InvalidData(
            "Feed cursor id must be nonblank".to_string(),
        ));
    }
    Ok((updated_at, id.to_string()))
}

pub fn encode_occurrence_cursor(
    scheduled_local: NaiveDateTime,
    schedule_revision_id: &str,
    ordinal: i32,
) -> String {
    format!("{scheduled_local}|{schedule_revision_id}|{ordinal}")
}

pub fn decode_occurrence_cursor(cursor: &str) -> Result<(NaiveDateTime, String, i32)> {
    let parts: Vec<&str> = cursor.splitn(3, '|').collect();
    if parts.len() != 3 {
        return Err(Error::InvalidData(
            "Occurrence cursor must be scheduledLocal|scheduleRevisionId|ordinal".to_string(),
        ));
    }
    let scheduled_local = NaiveDateTime::parse_from_str(parts[0], "%Y-%m-%d %H:%M:%S%.f")
        .or_else(|_| NaiveDateTime::parse_from_str(parts[0], "%Y-%m-%d %H:%M:%S"))
        .map_err(|_| Error::InvalidData("Occurrence cursor scheduledLocal is invalid".to_string()))?;
    let ordinal = parts[2]
        .parse::<i32>()
        .map_err(|_| Error::InvalidData("Occurrence cursor ordinal is invalid".to_string()))?;
    if parts[1].trim().is_empty() {
        return Err(Error::InvalidData(
            "Occurrence cursor scheduleRevisionId must be nonblank".to_string(),
        ));
    }
    Ok((scheduled_local, parts[1].to_string(), ordinal))
}

pub fn encode_failure_cursor(
    first_failed_at: NaiveDateTime,
    schedule_revision_id: &str,
    ordinal: i32,
) -> String {
    format!("{first_failed_at}|{schedule_revision_id}|{ordinal}")
}

pub fn decode_failure_cursor(cursor: &str) -> Result<(NaiveDateTime, String, i32)> {
    decode_occurrence_cursor(cursor).map_err(|_| {
        Error::InvalidData(
            "Failure cursor must be firstFailedAt|scheduleRevisionId|ordinal".to_string(),
        )
    })
}

pub fn get_recurring_transaction(
    conn: &mut SqliteConnection,
    id: &str,
) -> Result<RecurringTransaction> {
    let row = recurring_transactions::table
        .filter(recurring_transactions::id.eq(id))
        .select(RecurringTransactionRow::as_select())
        .first::<RecurringTransactionRow>(conn)
        .optional()
        .into_core()?
        .ok_or_else(|| Error::NotFound(id.to_string()))?;
    build_recurring_transaction(row)
}

pub fn list_feed(
    conn: &mut SqliteConnection,
    limit: i64,
    cursor: Option<&str>,
) -> Result<RecurringFeedPage> {
    let limit = normalize_feed_limit(limit)?;
    let mut query = recurring_transactions::table
        .filter(recurring_transactions::deleted_at.is_null())
        .into_boxed();

    if let Some(cursor) = cursor {
        let (updated_at, id) = decode_feed_cursor(cursor)?;
        query = query.filter(
            recurring_transactions::updated_at
                .lt(updated_at)
                .or(recurring_transactions::updated_at
                    .eq(updated_at)
                    .and(recurring_transactions::id.lt(id))),
        );
    }

    let rows = query
        .order((
            recurring_transactions::updated_at.desc(),
            recurring_transactions::id.desc(),
        ))
        .limit(limit + 1)
        .select(RecurringTransactionRow::as_select())
        .load::<RecurringTransactionRow>(conn)
        .into_core()?;

    let has_more = rows.len() as i64 > limit;
    let mut items = Vec::new();
    let mut last_row: Option<RecurringTransactionRow> = None;
    for row in rows.into_iter().take(limit as usize) {
        last_row = Some(row.clone());
        items.push(build_recurring_transaction(row)?);
    }

    let next_cursor = if has_more {
        last_row.map(|row| encode_feed_cursor(row.updated_at, &row.id))
    } else {
        None
    };

    Ok(RecurringFeedPage { items, next_cursor })
}

pub fn list_due_heads(
    conn: &mut SqliteConnection,
    observed_local: NaiveDateTime,
    limit: i64,
) -> Result<Vec<RecurringOccurrenceHead>> {
    let limit = normalize_feed_limit(limit)?;
    let rows = recurring_occurrence_heads::table
        .inner_join(
            recurring_transactions::table.on(recurring_occurrence_heads::recurring_transaction_id
                .eq(recurring_transactions::id)),
        )
        .filter(recurring_occurrence_heads::next_scheduled_local.le(observed_local))
        .filter(recurring_transactions::lifecycle.eq("active"))
        .filter(recurring_transactions::deleted_at.is_null())
        .order((
            recurring_occurrence_heads::next_scheduled_local.asc(),
            recurring_occurrence_heads::recurring_transaction_id.asc(),
        ))
        .limit(limit)
        .select(RecurringOccurrenceHeadRow::as_select())
        .load::<RecurringOccurrenceHeadRow>(conn)
        .into_core()?;

    Ok(rows.into_iter().map(build_occurrence_head).collect())
}

pub fn list_occurrences(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    limit: i64,
    cursor: Option<&str>,
) -> Result<RecurringOccurrencePage> {
    let limit = normalize_feed_limit(limit)?;
    let mut query = recurring_occurrences::table
        .filter(
            recurring_occurrences::recurring_transaction_id.eq(recurring_transaction_id),
        )
        .into_boxed();

    if let Some(cursor) = cursor {
        let (scheduled_local, schedule_revision_id, ordinal) = decode_occurrence_cursor(cursor)?;
        query = query.filter(
            recurring_occurrences::scheduled_local
                .lt(scheduled_local)
                .or(recurring_occurrences::scheduled_local.eq(scheduled_local).and(
                    recurring_occurrences::schedule_revision_id
                        .lt(schedule_revision_id.clone())
                        .or(recurring_occurrences::schedule_revision_id
                            .eq(schedule_revision_id)
                            .and(recurring_occurrences::ordinal.lt(ordinal))),
                )),
        );
    }

    let rows = query
        .order((
            recurring_occurrences::scheduled_local.desc(),
            recurring_occurrences::schedule_revision_id.desc(),
            recurring_occurrences::ordinal.desc(),
        ))
        .limit(limit + 1)
        .select(RecurringOccurrenceRow::as_select())
        .load::<RecurringOccurrenceRow>(conn)
        .into_core()?;

    let has_more = rows.len() as i64 > limit;
    let mut items = Vec::new();
    let mut last_row: Option<RecurringOccurrenceRow> = None;
    for row in rows.into_iter().take(limit as usize) {
        last_row = Some(row.clone());
        items.push(build_occurrence(row)?);
    }

    let next_cursor = if has_more {
        last_row.map(|row| {
            encode_occurrence_cursor(row.scheduled_local, &row.schedule_revision_id, row.ordinal)
        })
    } else {
        None
    };

    Ok(RecurringOccurrencePage { items, next_cursor })
}

pub fn find_provenance_by_transaction(
    conn: &mut SqliteConnection,
    transaction_id: &str,
) -> Result<Option<RecurringOccurrence>> {
    let row = recurring_occurrences::table
        .filter(recurring_occurrences::transaction_id.eq(transaction_id))
        .select(RecurringOccurrenceRow::as_select())
        .first::<RecurringOccurrenceRow>(conn)
        .optional()
        .into_core()?;
    row.map(build_occurrence).transpose()
}

pub fn list_failure_history(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    limit: i64,
    cursor: Option<&str>,
) -> Result<RecurringFailurePage> {
    let limit = normalize_failure_limit(limit)?;
    let mut query = recurring_generation_failures::table
        .filter(
            recurring_generation_failures::recurring_transaction_id
                .eq(recurring_transaction_id),
        )
        .into_boxed();

    if let Some(cursor) = cursor {
        let (first_failed_at, schedule_revision_id, ordinal) = decode_failure_cursor(cursor)?;
        query = query.filter(
            recurring_generation_failures::first_failed_at
                .lt(first_failed_at)
                .or(recurring_generation_failures::first_failed_at
                    .eq(first_failed_at)
                    .and(
                        recurring_generation_failures::schedule_revision_id
                            .lt(schedule_revision_id.clone())
                            .or(recurring_generation_failures::schedule_revision_id
                                .eq(schedule_revision_id)
                                .and(recurring_generation_failures::ordinal.lt(ordinal))),
                    )),
        );
    }

    let rows = query
        .order((
            recurring_generation_failures::first_failed_at.desc(),
            recurring_generation_failures::schedule_revision_id.desc(),
            recurring_generation_failures::ordinal.desc(),
        ))
        .limit(limit + 1)
        .select(RecurringGenerationFailureRow::as_select())
        .load::<RecurringGenerationFailureRow>(conn)
        .into_core()?;

    let has_more = rows.len() as i64 > limit;
    let mut items = Vec::new();
    let mut last_row: Option<RecurringGenerationFailureRow> = None;
    for row in rows.into_iter().take(limit as usize) {
        last_row = Some(row.clone());
        items.push(build_generation_failure(row));
    }

    let next_cursor = if has_more {
        last_row.map(|row| {
            encode_failure_cursor(row.first_failed_at, &row.schedule_revision_id, row.ordinal)
        })
    } else {
        None
    };

    Ok(RecurringFailurePage { items, next_cursor })
}

pub fn list_unresolved_failures(
    conn: &mut SqliteConnection,
    limit: i64,
) -> Result<Vec<RecurringGenerationFailure>> {
    let limit = normalize_failure_limit(limit)?;
    let rows = recurring_generation_failures::table
        .filter(recurring_generation_failures::resolved_at.is_null())
        .order((
            recurring_generation_failures::first_failed_at.desc(),
            recurring_generation_failures::schedule_revision_id.desc(),
            recurring_generation_failures::ordinal.desc(),
        ))
        .limit(limit)
        .select(RecurringGenerationFailureRow::as_select())
        .load::<RecurringGenerationFailureRow>(conn)
        .into_core()?;
    Ok(rows.into_iter().map(build_generation_failure).collect())
}
