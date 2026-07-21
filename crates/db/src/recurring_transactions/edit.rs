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
use diesel::sqlite::SqliteConnection;
use uuid::Uuid;
use zai_core::Error;
use zai_core::features::recurring_transactions::{
    RecurringLifecycle, RecurringTemplateInput, RecurringTransaction, ScheduleRule,
    UpdateRecurringTransaction, scheduled_local_at,
};

pub fn update_recurring_transaction(
    conn: &mut SqliteConnection,
    input: UpdateRecurringTransaction,
    observed_local: NaiveDateTime,
    apply_schedule: bool,
    apply_template: bool,
    apply_count: bool,
) -> Result<RecurringTransaction> {
    let now = chrono::Utc::now().naive_utc();
    let recurring = load_for_expected_revision(
        conn,
        &input.recurring_transaction_id,
        input.expected_revision,
    )?;

    if apply_schedule {
        apply_schedule_change(conn, &recurring.id, &input)?;
    }
    if apply_template {
        apply_template_change(conn, &recurring.id, &input.template, observed_local)?;
    }
    if apply_count {
        apply_count_change(conn, &recurring, &input, now)?;
    }
    bump_revision(conn, &recurring.id, input.expected_revision, now)?;
    load_recurring(conn, &recurring.id)
}

fn apply_schedule_change(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    input: &UpdateRecurringTransaction,
) -> Result<()> {
    let open = find_open_schedule_revision(conn, recurring_transaction_id)
        .map_err(StorageError::from)?
        .ok_or_else(|| {
            StorageError::CoreError(Error::Repository(
                "Missing open schedule revision".to_string(),
            ))
        })?;

    let boundary = input.next_scheduled_local;
    let first_scheduled_local =
        scheduled_local_at(&input.schedule, boundary, 1).map_err(StorageError::CoreError)?;
    let (interval_every, interval_unit, monthly_day) = schedule_columns(&input.schedule);

    // CHECK requires until > from; same-next edits must update the open segment in place.
    let schedule_revision_id = if boundary <= open.effective_from_local {
        diesel::update(
            recurring_schedule_revisions::table
                .filter(recurring_schedule_revisions::id.eq(&open.id)),
        )
        .set((
            recurring_schedule_revisions::effective_from_local.eq(boundary),
            recurring_schedule_revisions::first_scheduled_local.eq(first_scheduled_local),
            recurring_schedule_revisions::interval_every.eq(interval_every),
            recurring_schedule_revisions::interval_unit.eq(interval_unit),
            recurring_schedule_revisions::monthly_day.eq(monthly_day),
        ))
        .execute(conn)
        .into_storage()?;
        open.id
    } else {
        diesel::update(
            recurring_schedule_revisions::table
                .filter(recurring_schedule_revisions::id.eq(&open.id)),
        )
        .set(recurring_schedule_revisions::effective_until_local.eq(Some(boundary)))
        .execute(conn)
        .into_storage()?;

        let new_schedule_id = Uuid::new_v4().to_string();
        diesel::insert_into(recurring_schedule_revisions::table)
            .values(RecurringScheduleRevisionRow {
                id: new_schedule_id.clone(),
                recurring_transaction_id: recurring_transaction_id.to_string(),
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
        new_schedule_id
    };

    if let Some(head) = load_head(conn, recurring_transaction_id)?
        && head.next_scheduled_local >= boundary
    {
        diesel::update(recurring_occurrence_heads::table.filter(
            recurring_occurrence_heads::recurring_transaction_id.eq(recurring_transaction_id),
        ))
        .set((
            recurring_occurrence_heads::schedule_revision_id.eq(&schedule_revision_id),
            recurring_occurrence_heads::next_ordinal.eq(1),
            recurring_occurrence_heads::next_scheduled_local.eq(first_scheduled_local),
        ))
        .execute(conn)
        .into_storage()?;
    }

    Ok(())
}

fn apply_template_change(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
    template: &RecurringTemplateInput,
    effective_from_local: NaiveDateTime,
) -> Result<()> {
    let open = find_open_template_revision(conn, recurring_transaction_id)
        .map_err(StorageError::from)?
        .ok_or_else(|| {
            StorageError::CoreError(Error::Repository(
                "Missing open template revision".to_string(),
            ))
        })?;

    if effective_from_local <= open.effective_from_local {
        diesel::update(
            recurring_template_revisions::table
                .filter(recurring_template_revisions::id.eq(&open.id)),
        )
        .set((
            recurring_template_revisions::description.eq(&template.description),
            recurring_template_revisions::amount.eq(template.amount),
            recurring_template_revisions::transaction_type.eq(&template.transaction_type),
            recurring_template_revisions::transaction_category_id
                .eq(&template.transaction_category_id),
            recurring_template_revisions::notes.eq(&template.notes),
        ))
        .execute(conn)
        .into_storage()?;
        return Ok(());
    }

    diesel::update(
        recurring_template_revisions::table.filter(recurring_template_revisions::id.eq(&open.id)),
    )
    .set(recurring_template_revisions::effective_until_local.eq(Some(effective_from_local)))
    .execute(conn)
    .into_storage()?;

    diesel::insert_into(recurring_template_revisions::table)
        .values(template_row(
            recurring_transaction_id,
            open.sequence + 1,
            effective_from_local,
            template,
        ))
        .execute(conn)
        .into_storage()?;

    Ok(())
}

fn apply_count_change(
    conn: &mut SqliteConnection,
    recurring: &RecurringTransaction,
    input: &UpdateRecurringTransaction,
    now: NaiveDateTime,
) -> Result<()> {
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
        ))
        .execute(conn)
        .into_storage()?;
    } else {
        diesel::update(
            recurring_transactions::table
                .filter(recurring_transactions::id.eq(&recurring.id))
                .filter(recurring_transactions::revision.eq(input.expected_revision)),
        )
        .set(recurring_transactions::total_occurrences.eq(input.total_occurrences))
        .execute(conn)
        .into_storage()?;
    }

    Ok(())
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
