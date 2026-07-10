use super::models::{
    BudgetRevisionRow, BudgetRow, NewBudgetRevisionRow, NewBudgetRevisionScopeRow, NewBudgetRow,
};
use crate::connection::{DbPool, get_connection};
use crate::errors::{IntoCore, IntoStorage};
use crate::schema::{budget_revision_scopes, budget_revisions, budgets};
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use chrono::Utc;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::collections::HashMap;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::budgets::models::{BudgetListStatus, StoredBudget, StoredBudgetRevision};
use zai_core::features::budgets::traits::BudgetsRepositoryTrait;

pub struct BudgetsRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
}

impl BudgetsRepository {
    pub(crate) fn new(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
    ) -> Self {
        Self { pool, writer }
    }

    fn load_budgets(
        conn: &mut SqliteConnection,
        status: BudgetListStatus,
    ) -> crate::errors::Result<Vec<StoredBudget>> {
        let mut query = budgets::table.into_boxed();

        match status {
            BudgetListStatus::Active => {
                query = query.filter(budgets::deactivated_at.is_null());
            }
            BudgetListStatus::Deactivated => {
                query = query.filter(budgets::deactivated_at.is_not_null());
            }
            BudgetListStatus::All => {}
        }

        let budget_rows = query
            .order((budgets::name.asc(), budgets::created_at.asc()))
            .load::<BudgetRow>(conn)
            .into_storage()?;

        load_stored_budgets(conn, budget_rows)
    }

    fn load_budget_by_id(conn: &mut SqliteConnection, id: &str) -> crate::errors::Result<StoredBudget> {
        let budget_row = budgets::table
            .find(id)
            .first::<BudgetRow>(conn)
            .into_storage()?;

        load_stored_budgets(conn, vec![budget_row])?
            .into_iter()
            .next()
            .ok_or_else(|| diesel::result::Error::NotFound)
            .into_storage()
    }
}

fn load_stored_budgets(
    conn: &mut SqliteConnection,
    budget_rows: Vec<BudgetRow>,
) -> crate::errors::Result<Vec<StoredBudget>> {
    if budget_rows.is_empty() {
        return Ok(Vec::new());
    }

    let budget_ids = budget_rows
        .iter()
        .map(|budget| budget.id.clone())
        .collect::<Vec<_>>();

    let revision_rows = budget_revisions::table
        .filter(budget_revisions::budget_id.eq_any(&budget_ids))
        .order((
            budget_revisions::budget_id.asc(),
            budget_revisions::effective_period_start.asc(),
        ))
        .load::<BudgetRevisionRow>(conn)
        .into_storage()?;

    let revision_ids = revision_rows
        .iter()
        .map(|revision| revision.id.clone())
        .collect::<Vec<_>>();

    let scope_rows = if revision_ids.is_empty() {
        Vec::new()
    } else {
        budget_revision_scopes::table
            .filter(budget_revision_scopes::revision_id.eq_any(&revision_ids))
            .load::<super::models::BudgetRevisionScopeRow>(conn)
            .into_storage()?
    };

    let mut scopes_by_revision = HashMap::<String, Vec<String>>::new();
    for scope in scope_rows {
        scopes_by_revision
            .entry(scope.revision_id)
            .or_default()
            .push(scope.category_id);
    }

    for category_ids in scopes_by_revision.values_mut() {
        category_ids.sort();
    }

    let mut revisions_by_budget = HashMap::<String, Vec<(BudgetRevisionRow, Vec<String>)>>::new();
    for revision in revision_rows {
        let category_ids = scopes_by_revision
            .remove(&revision.id)
            .unwrap_or_default();
        revisions_by_budget
            .entry(revision.budget_id.clone())
            .or_default()
            .push((revision, category_ids));
    }

    budget_rows
        .into_iter()
        .map(|budget_row| {
            let revisions = revisions_by_budget
                .remove(&budget_row.id)
                .unwrap_or_default();
            budget_row.into_stored(revisions)
        })
        .collect::<zai_core::Result<Vec<_>>>()
        .into_storage()
}

#[async_trait]
impl BudgetsRepositoryTrait for BudgetsRepository {
    fn get_budgets(&self, status: BudgetListStatus) -> Result<Vec<StoredBudget>> {
        let conn = &mut get_connection(&self.pool)?;
        Self::load_budgets(conn, status).into_core()
    }

    fn get_budget(&self, id: &str) -> Result<StoredBudget> {
        let conn = &mut get_connection(&self.pool)?;
        Self::load_budget_by_id(conn, id).into_core()
    }

    fn find_active_budgets_with_scope_and_cadence(
        &self,
        cadence: &str,
        canonical_category_ids: &[String],
    ) -> Result<Vec<StoredBudget>> {
        let conn = &mut get_connection(&self.pool)?;
        let active_budgets = Self::load_budgets(conn, BudgetListStatus::Active)?;

        Ok(active_budgets
            .into_iter()
            .filter(|budget| {
                budget.cadence.as_str() == cadence
                    && budget
                        .revisions
                        .first()
                        .is_some_and(|revision| revision.category_ids == canonical_category_ids)
            })
            .collect())
    }

    async fn create_budget(
        &self,
        budget: StoredBudget,
        revision: StoredBudgetRevision,
    ) -> Result<StoredBudget> {
        let budget_id = budget.id.clone();

        self.writer
            .exec(move |conn: &mut SqliteConnection| -> crate::errors::Result<StoredBudget> {
                let now = Utc::now().naive_utc();
                let budget_row = NewBudgetRow {
                    id: &budget.id,
                    name: &budget.name,
                    cadence: budget.cadence.as_str(),
                    first_period_start: budget.first_period_start,
                    deactivated_at: budget.deactivated_at,
                    created_at: now,
                    updated_at: now,
                };

                diesel::insert_into(budgets::table)
                    .values(&budget_row)
                    .execute(conn)
                    .into_storage()?;

                let revision_row = NewBudgetRevisionRow {
                    id: &revision.id,
                    budget_id: &revision.budget_id,
                    effective_period_start: revision.effective_period_start,
                    allowance: revision.allowance,
                    created_at: now,
                    updated_at: now,
                };

                diesel::insert_into(budget_revisions::table)
                    .values(&revision_row)
                    .execute(conn)
                    .into_storage()?;

                let scope_rows = revision
                    .category_ids
                    .iter()
                    .map(|category_id| NewBudgetRevisionScopeRow {
                        revision_id: &revision.id,
                        category_id,
                    })
                    .collect::<Vec<_>>();

                diesel::insert_into(budget_revision_scopes::table)
                    .values(&scope_rows)
                    .execute(conn)
                    .into_storage()?;

                Self::load_budget_by_id(conn, &budget_id).into_storage()
            })
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection::{create_pool, run_migrations};
    use crate::write_actor::spawn_writer;
    use chrono::NaiveDate;
    use crate::schema::transaction_categories;
    use crate::transaction_categories::models::TransactionCategoryRow;
    use chrono::Utc;
    use zai_core::features::budgets::models::BudgetCadence;

    use std::path::PathBuf;

    fn setup_repository() -> (Arc<DbPool>, BudgetsRepository, PathBuf) {
        let db_path = std::env::temp_dir().join(format!("zai-budget-test-{}.db", uuid::Uuid::new_v4()));
        let pool = create_pool(&db_path).expect("pool");
        run_migrations(&pool).expect("migrations");
        let writer = spawn_writer(pool.as_ref().clone()).expect("writer");
        let pool = Arc::clone(&pool);
        (Arc::clone(&pool), BudgetsRepository::new(pool, writer), db_path)
    }

    fn insert_category(conn: &mut SqliteConnection, id: &str, name: &str) {
        let now = Utc::now().naive_utc();
        let row = TransactionCategoryRow {
            id: id.to_string(),
            parent_id: None,
            name: name.to_string(),
            description: None,
            color: Some("#951818".to_string()),
            created_at: now,
            updated_at: now,
            deleted_at: None,
        };

        diesel::insert_into(transaction_categories::table)
            .values(&row)
            .execute(conn)
            .expect("insert category");
    }

    #[tokio::test]
    async fn create_and_load_budget_persists_revision_and_scope() {
        let (pool, repository, _db_path) = setup_repository();
        let conn = &mut get_connection(&pool).expect("connection");
        insert_category(conn, "cat-1", "Food");
        insert_category(conn, "cat-2", "Travel");

        let budget_id = "budget-1".to_string();
        let revision_id = "revision-1".to_string();

        let stored = StoredBudget {
            id: budget_id.clone(),
            name: "Food".to_string(),
            cadence: BudgetCadence::Monthly,
            first_period_start: NaiveDate::from_ymd_opt(2026, 7, 1).unwrap(),
            deactivated_at: None,
            revisions: vec![StoredBudgetRevision {
                id: revision_id.clone(),
                budget_id: budget_id.clone(),
                effective_period_start: NaiveDate::from_ymd_opt(2026, 7, 1).unwrap(),
                allowance: 10_000,
                category_ids: vec!["cat-1".to_string(), "cat-2".to_string()],
            }],
        };

        let created = repository
            .create_budget(stored.clone(), stored.revisions[0].clone())
            .await
            .expect("create budget");

        assert_eq!(created.name, "Food");
        assert_eq!(created.revisions[0].category_ids, vec!["cat-1", "cat-2"]);

        let loaded = repository
            .get_budget(&budget_id)
            .expect("load budget");
        assert_eq!(loaded.revisions[0].allowance, 10_000);
    }
}
