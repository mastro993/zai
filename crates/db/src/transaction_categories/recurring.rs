use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::{
    recurring_occurrence_heads, recurring_template_revisions, recurring_transactions,
};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use std::collections::{BTreeMap, HashMap, HashSet};
use uuid::Uuid;
use zai_core::features::transaction_categories::models::{
    CategoryDeletionPreview, RecurringCategoryImpact,
};

#[derive(Debug, Clone)]
struct AffectedTemplate {
    recurring_transaction_id: String,
    description: String,
    id: String,
    effective_from_local: NaiveDateTime,
    effective_until_local: Option<NaiveDateTime>,
    head_local: NaiveDateTime,
    amount: i32,
    transaction_type: String,
    notes: Option<String>,
}

pub(super) fn preview(
    conn: &mut SqliteConnection,
    category_ids: &[String],
) -> Result<CategoryDeletionPreview> {
    Ok(preview_rows(&load_affected_templates(conn, category_ids)?))
}

pub(super) fn uncategorize_unfulfilled(
    conn: &mut SqliteConnection,
    category_ids: &[String],
    now: NaiveDateTime,
) -> Result<CategoryDeletionPreview> {
    let rows = load_affected_templates(conn, category_ids)?;
    let preview = preview_rows(&rows);
    if rows.is_empty() {
        return Ok(preview);
    }

    let source_ids = rows
        .iter()
        .map(|row| row.recurring_transaction_id.clone())
        .collect::<HashSet<_>>();
    let source_ids = source_ids.into_iter().collect::<Vec<_>>();
    let sequence_rows = recurring_template_revisions::table
        .filter(recurring_template_revisions::recurring_transaction_id.eq_any(&source_ids))
        .select((
            recurring_template_revisions::recurring_transaction_id,
            recurring_template_revisions::sequence,
        ))
        .load::<(String, i32)>(conn)
        .into_storage()?;
    let mut next_sequence = HashMap::<String, i32>::new();
    for (source_id, sequence) in sequence_rows {
        next_sequence
            .entry(source_id)
            .and_modify(|current| *current = (*current).max(sequence + 1))
            .or_insert(sequence + 1);
    }

    for row in rows {
        if row.head_local > row.effective_from_local {
            let new_id = Uuid::new_v4().to_string();
            let sequence = next_sequence
                .get_mut(&row.recurring_transaction_id)
                .ok_or_else(|| {
                    StorageError::CoreError(zai_core::Error::Repository(
                        "Missing recurring template sequence during category deletion".into(),
                    ))
                })?;
            let new_sequence = *sequence;
            *sequence += 1;

            diesel::update(
                recurring_template_revisions::table
                    .filter(recurring_template_revisions::id.eq(&row.id)),
            )
            .set(recurring_template_revisions::effective_until_local.eq(Some(row.head_local)))
            .execute(conn)
            .into_storage()?;

            diesel::insert_into(recurring_template_revisions::table)
                .values((
                    recurring_template_revisions::id.eq(new_id),
                    recurring_template_revisions::recurring_transaction_id
                        .eq(&row.recurring_transaction_id),
                    recurring_template_revisions::sequence.eq(new_sequence),
                    recurring_template_revisions::effective_from_local.eq(row.head_local),
                    recurring_template_revisions::effective_until_local
                        .eq(row.effective_until_local),
                    recurring_template_revisions::description.eq(row.description),
                    recurring_template_revisions::amount.eq(row.amount),
                    recurring_template_revisions::transaction_type.eq(row.transaction_type),
                    recurring_template_revisions::transaction_category_id.eq(None::<String>),
                    recurring_template_revisions::notes.eq(row.notes),
                ))
                .execute(conn)
                .into_storage()?;
        } else {
            diesel::update(
                recurring_template_revisions::table
                    .filter(recurring_template_revisions::id.eq(&row.id)),
            )
            .set(recurring_template_revisions::transaction_category_id.eq(None::<String>))
            .execute(conn)
            .into_storage()?;
        }
    }

    let source_revisions = recurring_transactions::table
        .filter(recurring_transactions::id.eq_any(&source_ids))
        .select((recurring_transactions::id, recurring_transactions::revision))
        .load::<(String, i32)>(conn)
        .into_storage()?;
    for (source_id, revision) in source_revisions {
        diesel::update(
            recurring_transactions::table.filter(recurring_transactions::id.eq(source_id)),
        )
        .set((
            recurring_transactions::revision.eq(revision + 1),
            recurring_transactions::updated_at.eq(now),
        ))
        .execute(conn)
        .into_storage()?;
    }

    Ok(preview)
}

fn load_affected_templates(
    conn: &mut SqliteConnection,
    category_ids: &[String],
) -> Result<Vec<AffectedTemplate>> {
    if category_ids.is_empty() {
        return Ok(Vec::new());
    }

    recurring_template_revisions::table
        .inner_join(recurring_transactions::table.on(
            recurring_template_revisions::recurring_transaction_id.eq(recurring_transactions::id),
        ))
        .inner_join(
            recurring_occurrence_heads::table
                .on(recurring_template_revisions::recurring_transaction_id
                    .eq(recurring_occurrence_heads::recurring_transaction_id)),
        )
        .filter(recurring_transactions::deleted_at.is_null())
        .filter(recurring_transactions::lifecycle.ne("tombstoned"))
        .filter(recurring_template_revisions::transaction_category_id.eq_any(category_ids))
        .filter(
            recurring_template_revisions::effective_until_local
                .is_null()
                .or(recurring_template_revisions::effective_until_local
                    .gt(recurring_occurrence_heads::next_scheduled_local.nullable())),
        )
        .order((
            recurring_template_revisions::recurring_transaction_id.asc(),
            recurring_template_revisions::effective_from_local.asc(),
            recurring_template_revisions::sequence.asc(),
        ))
        .select((
            recurring_template_revisions::recurring_transaction_id,
            recurring_template_revisions::description,
            recurring_template_revisions::id,
            recurring_template_revisions::effective_from_local,
            recurring_template_revisions::effective_until_local,
            recurring_occurrence_heads::next_scheduled_local,
            recurring_template_revisions::amount,
            recurring_template_revisions::transaction_type,
            recurring_template_revisions::notes,
        ))
        .load::<(
            String,
            String,
            String,
            NaiveDateTime,
            Option<NaiveDateTime>,
            NaiveDateTime,
            i32,
            String,
            Option<String>,
        )>(conn)
        .into_storage()
        .map(|rows| {
            rows.into_iter()
                .map(
                    |(
                        recurring_transaction_id,
                        description,
                        id,
                        effective_from_local,
                        effective_until_local,
                        head_local,
                        amount,
                        transaction_type,
                        notes,
                    )| AffectedTemplate {
                        recurring_transaction_id,
                        description,
                        id,
                        effective_from_local,
                        effective_until_local,
                        head_local,
                        amount,
                        transaction_type,
                        notes,
                    },
                )
                .collect()
        })
}

fn preview_rows(rows: &[AffectedTemplate]) -> CategoryDeletionPreview {
    let mut affected = BTreeMap::<String, String>::new();
    for row in rows {
        affected
            .entry(row.recurring_transaction_id.clone())
            .or_insert_with(|| row.description.clone());
    }

    CategoryDeletionPreview {
        affected_recurring_transactions: affected
            .into_iter()
            .map(
                |(recurring_transaction_id, description)| RecurringCategoryImpact {
                    recurring_transaction_id,
                    description,
                },
            )
            .collect(),
        affected_budgets: Vec::new(),
        blocked_by_current_budget: false,
    }
}
