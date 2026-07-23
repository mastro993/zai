use super::models::{RecurringTransactionRow, build_recurring_transaction};
use crate::errors::IntoCore;
use crate::schema::{
    recurring_generation_failures, recurring_occurrence_heads, recurring_template_revisions,
    recurring_transactions,
};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::features::recurring_transactions::{
    RecurringFeedEntry, RecurringFeedPage, RecurringRepairField,
};
use zai_core::{Error, Result};

pub fn encode_feed_cursor(updated_at: NaiveDateTime, id: &str) -> String {
    format!("{updated_at}|{id}")
}

pub fn decode_feed_cursor(cursor: &str) -> Result<(NaiveDateTime, String)> {
    let (updated_at, id) = cursor
        .split_once('|')
        .ok_or_else(|| Error::InvalidData("Feed cursor must be updatedAt|id".to_string()))?;
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

pub fn list_feed(
    conn: &mut SqliteConnection,
    limit: i64,
    cursor: Option<&str>,
) -> Result<RecurringFeedPage> {
    let limit = super::queries::normalize_feed_limit(limit)?;
    let mut query = recurring_transactions::table
        .filter(recurring_transactions::deleted_at.is_null())
        .into_boxed();

    if let Some(cursor) = cursor {
        let (updated_at, id) = decode_feed_cursor(cursor)?;
        query = query.filter(
            recurring_transactions::updated_at.lt(updated_at).or(
                recurring_transactions::updated_at
                    .eq(updated_at)
                    .and(recurring_transactions::id.lt(id)),
            ),
        );
    }

    let rows = query
        .inner_join(
            recurring_template_revisions::table.on(
                recurring_template_revisions::recurring_transaction_id
                    .eq(recurring_transactions::id)
                    .and(recurring_template_revisions::effective_until_local.is_null()),
            ),
        )
        .left_join(recurring_occurrence_heads::table.on(
            recurring_occurrence_heads::recurring_transaction_id.eq(recurring_transactions::id),
        ))
        .left_join(
            recurring_generation_failures::table.on(
                recurring_generation_failures::recurring_transaction_id
                    .eq(recurring_transactions::id)
                    .and(recurring_generation_failures::resolved_at.is_null()),
            ),
        )
        .order((
            recurring_transactions::updated_at.desc(),
            recurring_transactions::id.desc(),
        ))
        .limit(limit + 1)
        .select((
            RecurringTransactionRow::as_select(),
            recurring_template_revisions::description,
            recurring_occurrence_heads::next_scheduled_local.nullable(),
            recurring_generation_failures::recurring_transaction_id.nullable(),
            recurring_generation_failures::repair_field_key.nullable(),
        ))
        .load::<(
            RecurringTransactionRow,
            String,
            Option<NaiveDateTime>,
            Option<String>,
            Option<String>,
        )>(conn)
        .into_core()?;

    let has_more = rows.len() as i64 > limit;
    let mut items = Vec::new();
    let mut last_row: Option<RecurringTransactionRow> = None;
    for (recurring, description, next_scheduled_local, failure_id, repair_field_key) in
        rows.into_iter().take(limit as usize)
    {
        last_row = Some(recurring.clone());
        let needs_attention = if failure_id.is_some() {
            if let Some(repair_field_key) = repair_field_key.as_deref() {
                RecurringRepairField::from_storage_key(repair_field_key)?;
            }
            true
        } else {
            false
        };
        items.push(RecurringFeedEntry {
            recurring_transaction: build_recurring_transaction(recurring)?,
            description,
            next_scheduled_local,
            needs_attention,
        });
    }

    let next_cursor = if has_more {
        last_row.map(|row| encode_feed_cursor(row.updated_at, &row.id))
    } else {
        None
    };

    Ok(RecurringFeedPage { items, next_cursor })
}
