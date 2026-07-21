use super::create::{find_open_schedule_revision, find_open_template_revision};
use super::models::{
    RecurringOccurrenceHeadRow, RecurringScheduleRevisionRow, RecurringTemplateRevisionRow,
    RecurringTransactionRow, build_recurring_transaction,
};
use crate::errors::{IntoStorage, Result, StorageError};
use crate::schema::{
    recurring_occurrence_heads, recurring_schedule_revisions, recurring_template_revisions,
    recurring_transactions,
};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::result::{DatabaseErrorKind, Error as DieselError};
use diesel::sqlite::SqliteConnection;
use uuid::Uuid;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    EditRecurringCount, EditRecurringSchedule, EditRecurringTemplate, RecurringLifecycle,
    RecurringTemplateInput, RecurringTransaction, ScheduleRule, scheduled_local_at,
};

pub struct RenameInput {
    pub recurring_transaction_id: String,
    pub expected_revision: i32,
    pub name: String,
}

pub fn rename_recurring_transaction(
    conn: &mut SqliteConnection,
    input: RenameInput,
) -> Result<RecurringTransaction> {
    let now = chrono::Utc::now().naive_utc();
    let updated = diesel::update(
        recurring_transactions::table
            .filter(recurring_transactions::id.eq(&input.recurring_transaction_id))
            .filter(recurring_transactions::revision.eq(input.expected_revision))
            .filter(recurring_transactions::deleted_at.is_null()),
    )
    .set((
        recurring_transactions::name.eq(&input.name),
        recurring_transactions::revision.eq(input.expected_revision + 1),
        recurring_transactions::updated_at.eq(now),
    ))
    .execute(conn)
    .map_err(map_name_conflict)?;

    if updated == 0 {
        return Err(StorageError::CoreError(revision_or_not_found(
            conn,
            &input.recurring_transaction_id,
            input.expected_revision,
        )));
    }

    load_recurring(conn, &input.recurring_transaction_id)
}

pub fn edit_recurring_schedule(
    conn: &mut SqliteConnection,
    input: EditRecurringSchedule,
) -> Result<RecurringTransaction> {
    let now = chrono::Utc::now().naive_utc();
    let recurring = load_for_expected_revision(
        conn,
        &input.recurring_transaction_id,
        input.expected_revision,
    )?;
    let open = find_open_schedule_revision(conn, &recurring.id)
        .map_err(StorageError::from)?
        .ok_or_else(|| {
            StorageError::CoreError(Error::Repository(
                "Missing open schedule revision".to_string(),
            ))
        })?;

    let boundary = input.next_scheduled_local;
    let first_scheduled_local =
        scheduled_local_at(&input.schedule, boundary, 1).map_err(StorageError::CoreError)?;

    diesel::update(
        recurring_schedule_revisions::table.filter(recurring_schedule_revisions::id.eq(&open.id)),
    )
    .set(recurring_schedule_revisions::effective_until_local.eq(Some(boundary)))
    .execute(conn)
    .into_storage()?;

    let (interval_every, interval_unit, monthly_day) = schedule_columns(&input.schedule);
    let new_schedule_id = Uuid::new_v4().to_string();
    diesel::insert_into(recurring_schedule_revisions::table)
        .values(RecurringScheduleRevisionRow {
            id: new_schedule_id.clone(),
            recurring_transaction_id: recurring.id.clone(),
            sequence: open.sequence + 1,
            effective_from_local: boundary,
            effective_until_local: None,
            first_scheduled_local,
            interval_every,
            interval_unit,
            monthly_day,
        })
        .execute(conn)
        .into_storage()?;

    if let Some(head) = load_head(conn, &recurring.id)?
        && head.next_scheduled_local >= boundary
    {
        diesel::update(
            recurring_occurrence_heads::table
                .filter(recurring_occurrence_heads::recurring_transaction_id.eq(&recurring.id)),
        )
        .set((
            recurring_occurrence_heads::schedule_revision_id.eq(&new_schedule_id),
            recurring_occurrence_heads::next_ordinal.eq(1),
            recurring_occurrence_heads::next_scheduled_local.eq(first_scheduled_local),
        ))
        .execute(conn)
        .into_storage()?;
    }

    bump_revision(conn, &recurring.id, input.expected_revision, now)?;
    load_recurring(conn, &recurring.id)
}

pub fn edit_recurring_template(
    conn: &mut SqliteConnection,
    input: EditRecurringTemplate,
    effective_from_local: NaiveDateTime,
) -> Result<RecurringTransaction> {
    let now = chrono::Utc::now().naive_utc();
    let recurring = load_for_expected_revision(
        conn,
        &input.recurring_transaction_id,
        input.expected_revision,
    )?;
    let open = find_open_template_revision(conn, &recurring.id)
        .map_err(StorageError::from)?
        .ok_or_else(|| {
            StorageError::CoreError(Error::Repository(
                "Missing open template revision".to_string(),
            ))
        })?;

    diesel::update(
        recurring_template_revisions::table.filter(recurring_template_revisions::id.eq(&open.id)),
    )
    .set(recurring_template_revisions::effective_until_local.eq(Some(effective_from_local)))
    .execute(conn)
    .into_storage()?;

    diesel::insert_into(recurring_template_revisions::table)
        .values(template_row(
            &recurring.id,
            open.sequence + 1,
            effective_from_local,
            &input.template,
        ))
        .execute(conn)
        .into_storage()?;

    bump_revision(conn, &recurring.id, input.expected_revision, now)?;
    load_recurring(conn, &recurring.id)
}

pub fn edit_recurring_count(
    conn: &mut SqliteConnection,
    input: EditRecurringCount,
) -> Result<RecurringTransaction> {
    let now = chrono::Utc::now().naive_utc();
    let recurring = load_for_expected_revision(
        conn,
        &input.recurring_transaction_id,
        input.expected_revision,
    )?;

    let completes = input
        .total_occurrences
        .is_some_and(|total| total == recurring.fulfilled_count);

    if completes {
        diesel::delete(
            recurring_occurrence_heads::table
                .filter(recurring_occurrence_heads::recurring_transaction_id.eq(&recurring.id)),
        )
        .execute(conn)
        .into_storage()?;

        diesel::update(
            recurring_transactions::table
                .filter(recurring_transactions::id.eq(&recurring.id))
                .filter(recurring_transactions::revision.eq(input.expected_revision)),
        )
        .set((
            recurring_transactions::total_occurrences.eq(input.total_occurrences),
            recurring_transactions::lifecycle.eq(RecurringLifecycle::Completed.as_str()),
            recurring_transactions::lifecycle_changed_at.eq(now),
            recurring_transactions::paused_at.eq(None::<NaiveDateTime>),
            recurring_transactions::revision.eq(input.expected_revision + 1),
            recurring_transactions::updated_at.eq(now),
        ))
        .execute(conn)
        .into_storage()?;
    } else {
        diesel::update(
            recurring_transactions::table
                .filter(recurring_transactions::id.eq(&recurring.id))
                .filter(recurring_transactions::revision.eq(input.expected_revision)),
        )
        .set((
            recurring_transactions::total_occurrences.eq(input.total_occurrences),
            recurring_transactions::revision.eq(input.expected_revision + 1),
            recurring_transactions::updated_at.eq(now),
        ))
        .execute(conn)
        .into_storage()?;
    }

    load_recurring(conn, &recurring.id)
}

fn template_row(
    recurring_transaction_id: &str,
    sequence: i32,
    effective_from_local: NaiveDateTime,
    template: &RecurringTemplateInput,
) -> RecurringTemplateRevisionRow {
    RecurringTemplateRevisionRow {
        id: Uuid::new_v4().to_string(),
        recurring_transaction_id: recurring_transaction_id.to_string(),
        sequence,
        effective_from_local,
        effective_until_local: None,
        description: template.description.clone(),
        amount: template.amount,
        transaction_type: template.transaction_type.clone(),
        transaction_category_id: template.transaction_category_id.clone(),
        notes: template.notes.clone(),
    }
}

fn schedule_columns(rule: &ScheduleRule) -> (Option<i32>, Option<String>, Option<i32>) {
    match rule {
        ScheduleRule::Interval { every, unit } => {
            (Some(*every), Some(unit.as_str().to_string()), None)
        }
        ScheduleRule::MonthlyDay { day } => (None, None, Some(*day)),
    }
}

fn load_for_expected_revision(
    conn: &mut SqliteConnection,
    id: &str,
    expected_revision: i32,
) -> Result<RecurringTransaction> {
    let recurring = load_recurring(conn, id)?;
    if recurring.deleted_at.is_some() || recurring.lifecycle == RecurringLifecycle::Tombstoned {
        return Err(StorageError::CoreError(Error::NotFound(format!(
            "Recurring transaction {id} not found"
        ))));
    }
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

fn load_head(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
) -> Result<Option<RecurringOccurrenceHeadRow>> {
    recurring_occurrence_heads::table
        .filter(recurring_occurrence_heads::recurring_transaction_id.eq(recurring_transaction_id))
        .select(RecurringOccurrenceHeadRow::as_select())
        .first::<RecurringOccurrenceHeadRow>(conn)
        .optional()
        .into_storage()
}

fn revision_or_not_found(conn: &mut SqliteConnection, id: &str, expected_revision: i32) -> Error {
    match load_recurring(conn, id) {
        Ok(recurring)
            if recurring.deleted_at.is_none()
                && recurring.lifecycle != RecurringLifecycle::Tombstoned =>
        {
            if recurring.revision == expected_revision {
                Error::Unexpected("Rename update matched revision but wrote zero rows".into())
            } else {
                Error::RevisionConflict {
                    current_revision: i64::from(recurring.revision),
                }
            }
        }
        _ => Error::NotFound(format!("Recurring transaction {id} not found")),
    }
}

fn map_name_conflict(error: DieselError) -> StorageError {
    match error {
        DieselError::DatabaseError(DatabaseErrorKind::UniqueViolation, _) => {
            StorageError::CoreError(Error::NameConflict(
                "A recurring transaction with this name already exists".to_string(),
            ))
        }
        error => StorageError::from(error),
    }
}
