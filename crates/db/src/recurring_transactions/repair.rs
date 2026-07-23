use super::create::find_open_template_revision;
use super::models::{
    RecurringTemplateRevisionRow, RecurringTransactionRow, build_recurring_transaction,
};
use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::{
    recurring_generation_failures, recurring_occurrence_heads, recurring_template_revisions,
    recurring_transactions, transaction_categories,
};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use uuid::Uuid;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    RecurringRepairField, RecurringTemplateInput, RecurringTransaction,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RepairApplication {
    pub affected_unfulfilled_segment_count: i32,
    pub includes_future_template: bool,
    pub recurring: RecurringTransaction,
}

pub fn preview_template_field_repair(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
) -> Result<(i32, bool)> {
    let segments = load_unfulfilled_template_segments(conn, recurring_transaction_id)?;
    let includes_future_template = segments
        .iter()
        .any(|row| row.effective_until_local.is_none());
    Ok((segments.len() as i32, includes_future_template))
}

pub fn apply_generation_repair(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    expected_revision: i32,
    repair_field_key: RecurringRepairField,
    template: &RecurringTemplateInput,
    now: NaiveDateTime,
) -> Result<RepairApplication> {
    let _ = load_for_expected_revision(conn, recurring_transaction_id, expected_revision)?;
    validate_repair_value(conn, repair_field_key, template)?;

    let segments = load_unfulfilled_template_segments(conn, recurring_transaction_id)?;
    if segments.is_empty() {
        return Err(StorageError::CoreError(Error::InvalidData(
            "No unfulfilled template segments to repair".to_string(),
        )));
    }
    let includes_future_template = segments
        .iter()
        .any(|row| row.effective_until_local.is_none());
    let affected_unfulfilled_segment_count = segments.len() as i32;
    let head_local = load_head_local(conn, recurring_transaction_id)?.ok_or_else(|| {
        StorageError::CoreError(Error::Repository(
            "Missing occurrence head for repair".to_string(),
        ))
    })?;
    let open = find_open_template_revision(conn, recurring_transaction_id)
        .map_err(StorageError::from)?
        .ok_or_else(|| {
            StorageError::CoreError(Error::Repository(
                "Missing open template revision".to_string(),
            ))
        })?;

    for segment in segments {
        if segment.effective_from_local >= head_local || segment.id == open.id {
            update_segment_field(conn, &segment.id, repair_field_key, template)?;
            continue;
        }

        diesel::update(
            recurring_template_revisions::table
                .filter(recurring_template_revisions::id.eq(&segment.id)),
        )
        .set(recurring_template_revisions::effective_until_local.eq(Some(head_local)))
        .execute(conn)
        .into_storage()?;

        let mut patched = segment;
        patched.id = Uuid::new_v4().to_string();
        patched.sequence = next_sequence(conn, recurring_transaction_id)?;
        patched.effective_from_local = head_local;
        apply_field_to_row(&mut patched, repair_field_key, template);
        diesel::insert_into(recurring_template_revisions::table)
            .values(&patched)
            .execute(conn)
            .into_storage()?;
    }

    mark_failure_repaired(conn, recurring_transaction_id, expected_revision + 1, now)?;
    bump_revision(conn, recurring_transaction_id, expected_revision, now)?;

    Ok(RepairApplication {
        affected_unfulfilled_segment_count,
        includes_future_template,
        recurring: load_recurring(conn, recurring_transaction_id)?,
    })
}

fn update_segment_field(
    conn: &mut SqliteConnection,
    segment_id: &str,
    repair_field_key: RecurringRepairField,
    template: &RecurringTemplateInput,
) -> Result<()> {
    match repair_field_key {
        RecurringRepairField::TransactionCategoryId => {
            diesel::update(
                recurring_template_revisions::table
                    .filter(recurring_template_revisions::id.eq(segment_id)),
            )
            .set(
                recurring_template_revisions::transaction_category_id
                    .eq(&template.transaction_category_id),
            )
            .execute(conn)
            .into_storage()?;
        }
        RecurringRepairField::Amount => {
            diesel::update(
                recurring_template_revisions::table
                    .filter(recurring_template_revisions::id.eq(segment_id)),
            )
            .set(recurring_template_revisions::amount.eq(template.amount))
            .execute(conn)
            .into_storage()?;
        }
    }
    Ok(())
}

fn apply_field_to_row(
    row: &mut RecurringTemplateRevisionRow,
    repair_field_key: RecurringRepairField,
    template: &RecurringTemplateInput,
) {
    match repair_field_key {
        RecurringRepairField::TransactionCategoryId => {
            row.transaction_category_id = template.transaction_category_id.clone();
        }
        RecurringRepairField::Amount => {
            row.amount = template.amount;
        }
    }
}

fn validate_repair_value(
    conn: &mut SqliteConnection,
    repair_field_key: RecurringRepairField,
    template: &RecurringTemplateInput,
) -> Result<()> {
    match repair_field_key {
        RecurringRepairField::TransactionCategoryId => {
            if let Some(category_id) = template.transaction_category_id.as_deref() {
                let exists = transaction_categories::table
                    .filter(transaction_categories::id.eq(category_id))
                    .filter(transaction_categories::deleted_at.is_null())
                    .select(transaction_categories::id)
                    .first::<String>(conn)
                    .optional()
                    .into_storage()?;
                if exists.is_none() {
                    return Err(StorageError::CoreError(Error::InvalidData(
                        "Repair category does not exist".to_string(),
                    )));
                }
            }
            Ok(())
        }
        RecurringRepairField::Amount => {
            if template.amount < 0 {
                return Err(StorageError::CoreError(Error::InvalidData(
                    "Template amount cannot be negative".to_string(),
                )));
            }
            Ok(())
        }
    }
}

fn load_unfulfilled_template_segments(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
) -> Result<Vec<RecurringTemplateRevisionRow>> {
    let Some(head_local) = load_head_local(conn, recurring_transaction_id)? else {
        return Ok(Vec::new());
    };
    recurring_template_revisions::table
        .filter(recurring_template_revisions::recurring_transaction_id.eq(recurring_transaction_id))
        .filter(
            recurring_template_revisions::effective_until_local
                .is_null()
                .or(recurring_template_revisions::effective_until_local.gt(head_local)),
        )
        .order(recurring_template_revisions::sequence.asc())
        .select(RecurringTemplateRevisionRow::as_select())
        .load::<RecurringTemplateRevisionRow>(conn)
        .into_storage()
}

fn mark_failure_repaired(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    repair_revision: i32,
    now: NaiveDateTime,
) -> Result<()> {
    let updated = diesel::update(
        recurring_generation_failures::table
            .filter(
                recurring_generation_failures::recurring_transaction_id
                    .eq(recurring_transaction_id),
            )
            .filter(recurring_generation_failures::resolved_at.is_null()),
    )
    .set((
        recurring_generation_failures::repaired_at.eq(Some(now)),
        recurring_generation_failures::repair_revision.eq(Some(repair_revision)),
    ))
    .execute(conn)
    .into_storage()?;
    if updated == 0 {
        return Err(StorageError::CoreError(Error::InvalidData(
            "No open generation failure to repair".to_string(),
        )));
    }
    Ok(())
}

fn next_sequence(conn: &mut SqliteConnection, recurring_transaction_id: &str) -> Result<i32> {
    let max = recurring_template_revisions::table
        .filter(recurring_template_revisions::recurring_transaction_id.eq(recurring_transaction_id))
        .select(diesel::dsl::max(recurring_template_revisions::sequence))
        .first::<Option<i32>>(conn)
        .into_storage()?
        .unwrap_or(0);
    Ok(max + 1)
}

fn load_head_local(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
) -> Result<Option<NaiveDateTime>> {
    recurring_occurrence_heads::table
        .filter(recurring_occurrence_heads::recurring_transaction_id.eq(recurring_transaction_id))
        .select(recurring_occurrence_heads::next_scheduled_local)
        .first::<NaiveDateTime>(conn)
        .optional()
        .into_storage()
}

fn load_for_expected_revision(
    conn: &mut SqliteConnection,
    id: &str,
    expected_revision: i32,
) -> Result<RecurringTransaction> {
    let recurring = load_recurring(conn, id)?;
    if recurring.revision != expected_revision {
        return Err(StorageError::CoreError(Error::RevisionConflict {
            current_revision: i64::from(recurring.revision),
        }));
    }
    Ok(recurring)
}

fn bump_revision(
    conn: &mut SqliteConnection,
    id: &str,
    expected_revision: i32,
    now: NaiveDateTime,
) -> Result<()> {
    let updated = diesel::update(
        recurring_transactions::table
            .filter(recurring_transactions::id.eq(id))
            .filter(recurring_transactions::revision.eq(expected_revision)),
    )
    .set((
        recurring_transactions::revision.eq(expected_revision + 1),
        recurring_transactions::updated_at.eq(now),
    ))
    .execute(conn)
    .into_storage()?;
    if updated == 0 {
        return Err(StorageError::CoreError(Error::RevisionConflict {
            current_revision: i64::from(expected_revision),
        }));
    }
    Ok(())
}

fn load_recurring(conn: &mut SqliteConnection, id: &str) -> Result<RecurringTransaction> {
    let row = recurring_transactions::table
        .filter(recurring_transactions::id.eq(id))
        .select(RecurringTransactionRow::as_select())
        .first::<RecurringTransactionRow>(conn)
        .optional()
        .into_storage()?
        .ok_or_else(|| {
            StorageError::CoreError(Error::NotFound(format!(
                "Recurring transaction {id} not found"
            )))
        })?;
    build_recurring_transaction(row).map_err(StorageError::from)
}
