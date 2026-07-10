use chrono::{NaiveDate, NaiveDateTime};
use diesel::{Insertable, Queryable, Selectable};
use zai_core::features::budgets::models::{BudgetCadence, StoredBudget, StoredBudgetRevision};

use crate::schema::{budget_revision_scopes, budget_revisions, budgets};

#[derive(Debug, Queryable, Selectable)]
#[diesel(table_name = budgets)]
pub struct BudgetRow {
    pub id: String,
    pub name: String,
    pub cadence: String,
    pub first_period_start: NaiveDate,
    pub deactivated_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Queryable, Selectable)]
#[diesel(table_name = budget_revisions)]
pub struct BudgetRevisionRow {
    pub id: String,
    pub budget_id: String,
    pub effective_period_start: NaiveDate,
    pub allowance: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Queryable, Selectable)]
#[diesel(table_name = budget_revision_scopes)]
pub struct BudgetRevisionScopeRow {
    pub revision_id: String,
    pub category_id: String,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = budgets)]
pub struct NewBudgetRow<'a> {
    pub id: &'a str,
    pub name: &'a str,
    pub cadence: &'a str,
    pub first_period_start: NaiveDate,
    pub deactivated_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = budget_revisions)]
pub struct NewBudgetRevisionRow<'a> {
    pub id: &'a str,
    pub budget_id: &'a str,
    pub effective_period_start: NaiveDate,
    pub allowance: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = budget_revision_scopes)]
pub struct NewBudgetRevisionScopeRow<'a> {
    pub revision_id: &'a str,
    pub category_id: &'a str,
}

impl BudgetRow {
    pub fn into_stored(
        self,
        revisions: Vec<(BudgetRevisionRow, Vec<String>)>,
    ) -> zai_core::Result<StoredBudget> {
        let cadence = BudgetCadence::parse(&self.cadence)?;
        let stored_revisions = revisions
            .into_iter()
            .map(|(revision, category_ids)| StoredBudgetRevision {
                id: revision.id,
                budget_id: revision.budget_id,
                effective_period_start: revision.effective_period_start,
                allowance: revision.allowance,
                category_ids,
            })
            .collect();

        Ok(StoredBudget {
            id: self.id,
            name: self.name,
            cadence,
            first_period_start: self.first_period_start,
            deactivated_at: self.deactivated_at,
            revisions: stored_revisions,
        })
    }
}
