mod calculate;
mod impact;
mod inspect;
mod persistence;
mod reconcile;

#[cfg(test)]
mod contract_edge_tests;
#[cfg(test)]
mod contract_ops_tests;
#[cfg(test)]
mod contract_support;

pub(crate) use calculate::load_category_hierarchy;
pub(crate) use inspect::InspectState;
pub(crate) use persistence::period_from_rows;

use chrono::NaiveDateTime;
use diesel::sqlite::SqliteConnection;
use zai_core::features::budgets::models::{Budget, BudgetListFilter, BudgetPeriod};

use crate::transactions::models::TransactionRow;

pub(crate) struct BudgetPeriodTimeline;

pub(crate) enum TimelineSelection {
    Filter(BudgetListFilter),
    Ids(Vec<String>),
}

#[derive(Clone, Debug)]
pub(crate) enum TimelineInspectEntry {
    Current(Budget),
    Stale { id: String },
}

#[derive(Debug)]
pub(crate) struct TimelineInspect {
    pub entries: Vec<TimelineInspectEntry>,
}

impl TimelineInspect {
    pub fn stale_ids(&self) -> Vec<String> {
        self.entries
            .iter()
            .filter_map(|entry| match entry {
                TimelineInspectEntry::Stale { id } => Some(id.clone()),
                TimelineInspectEntry::Current(_) => None,
            })
            .collect()
    }
}

#[derive(Debug)]
pub(crate) struct TimelineChange {
    pub budget_id: String,
    pub previous_current: Option<BudgetPeriod>,
    pub resulting_current: BudgetPeriod,
}

#[derive(Debug)]
pub(crate) enum SourceChange {
    BudgetCreated {
        budget_id: String,
        category_ids: Vec<String>,
    },
    BudgetConfigured {
        budget_id: String,
    },
    Transactions {
        old: Vec<TransactionRow>,
        new: Vec<TransactionRow>,
    },
    CategoriesAffected {
        budget_ids: Vec<String>,
    },
}

impl BudgetPeriodTimeline {
    pub fn inspect(
        conn: &mut SqliteConnection,
        selection: TimelineSelection,
        now: NaiveDateTime,
    ) -> crate::errors::Result<TimelineInspect> {
        inspect::inspect(conn, selection, now)
    }

    pub fn ensure_current(
        conn: &mut SqliteConnection,
        ids: &[String],
        now: NaiveDateTime,
    ) -> crate::errors::Result<(Vec<Budget>, Vec<TimelineChange>)> {
        reconcile::ensure_ids(conn, ids, now)
    }

    pub fn reconcile(
        conn: &mut SqliteConnection,
        change: SourceChange,
        now: NaiveDateTime,
    ) -> crate::errors::Result<Vec<TimelineChange>> {
        reconcile::reconcile_change(conn, change, now)
    }
}

pub(crate) fn load_current_or_ensure(
    conn: &mut SqliteConnection,
    id: &str,
    now: NaiveDateTime,
) -> crate::errors::Result<Budget> {
    reconcile::load_current_or_ensure(conn, id, now)
}

pub(crate) fn inspect_budget(
    conn: &mut SqliteConnection,
    id: &str,
    now: NaiveDateTime,
) -> crate::errors::Result<inspect::InspectState> {
    inspect::inspect_budget(conn, id, now)
}
