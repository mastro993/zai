use super::models::{
    RecurringGenerationFailureRow, RecurringOccurrenceHeadRow, RecurringScheduleRevisionRow,
    RecurringTemplateRevisionRow, RecurringTransactionRow, build_generation_failure,
    build_occurrence_head, build_recurring_transaction, schedule_rule_from_row,
};
use crate::budgets::timeline::{
    BudgetPeriodTimeline, TimelineInspectEntry, TimelineSelection, calculate_spending,
    load_category_hierarchy,
};
use crate::errors::IntoCore;
use crate::schema::{
    recurring_generation_failures, recurring_occurrence_heads, recurring_schedule_revisions,
    recurring_template_revisions, recurring_transactions, transaction_categories,
};
use chrono::NaiveDateTime;
use diesel::OptionalExtension;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use std::collections::HashMap;
use zai_core::features::budgets::models::{
    BudgetListFilter, current_period, expand_category_scope,
};
use zai_core::features::recurring_transactions::projection::{
    ProjectionBudgetInput, ProjectionComputeInput, ProjectionSourceInput, projection_window,
};
use zai_core::features::recurring_transactions::{
    RecurringGenerationFailure, RecurringLifecycle, RecurringOccurrenceHead,
    RecurringScheduleRevision, RecurringTemplateRevision, RecurringTransaction,
};
use zai_core::features::transaction_categories::models::CategoryRole;
use zai_core::{Error, Result};

pub fn load_projection_compute_input(
    conn: &mut SqliteConnection,
    observed_local: NaiveDateTime,
    horizon_months: u32,
    include_paused_budgets: bool,
    focus_recurring_transaction_id: Option<String>,
) -> Result<ProjectionComputeInput> {
    let window = projection_window(observed_local, horizon_months)?;
    let filter = if include_paused_budgets {
        BudgetListFilter::All
    } else {
        BudgetListFilter::Active
    };
    let inspect =
        BudgetPeriodTimeline::inspect(conn, TimelineSelection::Filter(filter), observed_local)
            .into_core()?;

    let hierarchy = load_category_hierarchy(conn).into_core()?;
    let category_roles = load_category_roles(conn)?;
    let sources = list_active_projection_sources(conn)?;

    let mut budgets = Vec::new();
    let mut actual_spending = HashMap::new();

    for entry in inspect.entries {
        match entry {
            TimelineInspectEntry::Current(budget) => {
                let mut period_start = budget.current_period.start;
                let mut period_end = budget.current_period.end;
                let scope_ids = if budget.category_ids.is_empty() {
                    Vec::new()
                } else {
                    expand_category_scope(&budget.category_ids, &hierarchy)
                };
                let mut guard = 0_u32;
                while period_start < window.through_local {
                    guard = guard.saturating_add(1);
                    if guard > 2_000 {
                        return Err(Error::PeriodAdvanceLimitExceeded(
                            "Forecast period advance exceeds the 2,000-period limit".to_string(),
                        ));
                    }
                    let spending = if period_start == budget.current_period.start {
                        budget.current_period.net_budget_spending
                    } else {
                        calculate_spending(
                            conn,
                            period_start,
                            period_end,
                            budget.measurement_mode,
                            &scope_ids,
                        )
                        .into_core()?
                    };
                    actual_spending.insert((budget.id.clone(), period_start), spending);
                    let next = current_period(period_end, budget.cadence)?;
                    period_start = next.0;
                    period_end = next.1;
                }
                budgets.push(ProjectionBudgetInput {
                    scope_category_ids: budget.category_ids.clone(),
                    warning_percentage: budget.warning_percentage,
                    budget,
                    stale: false,
                });
            }
            TimelineInspectEntry::Stale { id } => {
                budgets.push(ProjectionBudgetInput {
                    budget: placeholder_stale_budget(&id, observed_local)?,
                    scope_category_ids: Vec::new(),
                    warning_percentage: None,
                    stale: true,
                });
            }
        }
    }

    let mut source_inputs = Vec::with_capacity(sources.len());
    for (recurring, head, schedule, failure) in sources {
        let templates = list_template_revisions(conn, &recurring.id)?;
        let templates_by_local = templates
            .into_iter()
            .map(|template| (template.effective_from_local, template))
            .collect();
        source_inputs.push(ProjectionSourceInput {
            recurring,
            head,
            open_schedule: schedule,
            unresolved_failure: failure,
            templates_by_local,
        });
    }

    Ok(ProjectionComputeInput {
        observed_local: window.observed_local,
        horizon_months: window.horizon_months,
        budgets,
        sources: source_inputs,
        category_roles,
        category_hierarchy: hierarchy,
        actual_spending,
        focus_recurring_transaction_id,
    })
}

fn placeholder_stale_budget(
    id: &str,
    observed_local: NaiveDateTime,
) -> Result<zai_core::features::budgets::models::Budget> {
    let (start, end) = current_period(
        observed_local,
        zai_core::features::budgets::models::BudgetCadence::Month,
    )?;
    Ok(zai_core::features::budgets::models::Budget {
        id: id.to_string(),
        name: id.to_string(),
        revision: 0,
        paused: false,
        category_ids: Vec::new(),
        cadence: zai_core::features::budgets::models::BudgetCadence::Month,
        measurement_mode: zai_core::features::budgets::models::BudgetMeasurementMode::Spending,
        base_allowance: 0,
        rollover_mode: zai_core::features::budgets::models::BudgetRolloverMode::Off,
        warning_percentage: None,
        current_period: zai_core::features::budgets::models::BudgetPeriod {
            start,
            end,
            base_allowance: 0,
            effective_allowance: 0,
            net_budget_spending: 0,
            remaining_allowance: 0,
            status: zai_core::features::budgets::models::BudgetStatus::OnTrack,
        },
    })
}

fn load_category_roles(conn: &mut SqliteConnection) -> Result<HashMap<String, CategoryRole>> {
    let rows = transaction_categories::table
        .filter(transaction_categories::deleted_at.is_null())
        .select((transaction_categories::id, transaction_categories::role))
        .load::<(String, String)>(conn)
        .into_core()?;
    let mut roles = HashMap::new();
    for (id, role) in rows {
        if let Ok(parsed) = role.parse::<CategoryRole>() {
            roles.insert(id, parsed);
        }
    }
    Ok(roles)
}

type ActiveSource = (
    RecurringTransaction,
    RecurringOccurrenceHead,
    RecurringScheduleRevision,
    Option<RecurringGenerationFailure>,
);

fn list_active_projection_sources(conn: &mut SqliteConnection) -> Result<Vec<ActiveSource>> {
    let rows = recurring_transactions::table
        .inner_join(recurring_occurrence_heads::table.on(
            recurring_occurrence_heads::recurring_transaction_id.eq(recurring_transactions::id),
        ))
        .filter(recurring_transactions::deleted_at.is_null())
        .filter(recurring_transactions::lifecycle.eq(RecurringLifecycle::Active.as_str()))
        .order((
            recurring_occurrence_heads::next_scheduled_local.asc(),
            recurring_transactions::id.asc(),
        ))
        .select((
            RecurringTransactionRow::as_select(),
            RecurringOccurrenceHeadRow::as_select(),
        ))
        .load::<(RecurringTransactionRow, RecurringOccurrenceHeadRow)>(conn)
        .into_core()?;

    let mut sources = Vec::with_capacity(rows.len());
    for (recurring_row, head_row) in rows {
        let recurring = build_recurring_transaction(recurring_row)?;
        let head = build_occurrence_head(head_row);
        let schedule_row = recurring_schedule_revisions::table
            .filter(recurring_schedule_revisions::recurring_transaction_id.eq(&recurring.id))
            .filter(recurring_schedule_revisions::effective_until_local.is_null())
            .first::<RecurringScheduleRevisionRow>(conn)
            .optional()
            .into_core()?
            .ok_or_else(|| {
                Error::Repository(format!(
                    "Missing open schedule revision for recurring transaction {}",
                    recurring.id
                ))
            })?;
        let rule = schedule_rule_from_row(&schedule_row)?;
        let schedule = RecurringScheduleRevision {
            id: schedule_row.id,
            recurring_transaction_id: schedule_row.recurring_transaction_id,
            sequence: schedule_row.sequence,
            effective_from_local: schedule_row.effective_from_local,
            effective_until_local: schedule_row.effective_until_local,
            first_scheduled_local: schedule_row.first_scheduled_local,
            rule,
        };
        let failure = recurring_generation_failures::table
            .filter(recurring_generation_failures::recurring_transaction_id.eq(&recurring.id))
            .filter(recurring_generation_failures::resolved_at.is_null())
            .first::<RecurringGenerationFailureRow>(conn)
            .optional()
            .into_core()?
            .map(build_generation_failure);
        sources.push((recurring, head, schedule, failure));
    }
    Ok(sources)
}

fn list_template_revisions(
    conn: &mut SqliteConnection,
    recurring_transaction_id: &str,
) -> Result<Vec<RecurringTemplateRevision>> {
    let rows = recurring_template_revisions::table
        .filter(recurring_template_revisions::recurring_transaction_id.eq(recurring_transaction_id))
        .order(recurring_template_revisions::effective_from_local.asc())
        .load::<RecurringTemplateRevisionRow>(conn)
        .into_core()?;
    Ok(rows
        .into_iter()
        .map(|row| RecurringTemplateRevision {
            id: row.id,
            recurring_transaction_id: row.recurring_transaction_id,
            sequence: row.sequence,
            effective_from_local: row.effective_from_local,
            effective_until_local: row.effective_until_local,
            description: row.description,
            amount: row.amount,
            transaction_type: row.transaction_type,
            transaction_category_id: row.transaction_category_id,
            notes: row.notes,
        })
        .collect())
}

pub fn read_schema_version(conn: &mut SqliteConnection) -> Result<String> {
    #[derive(QueryableByName)]
    struct SchemaVersionRow {
        #[diesel(sql_type = diesel::sql_types::Text)]
        version: String,
    }
    let row = diesel::sql_query(
        "SELECT version FROM __diesel_schema_migrations ORDER BY version DESC LIMIT 1",
    )
    .get_result::<SchemaVersionRow>(conn)
    .map_err(|error| Error::Database(zai_core::DatabaseError::QueryFailed(error.to_string())))?;
    Ok(row.version)
}
