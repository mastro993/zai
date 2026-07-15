use super::models::{TransactionCategoryRow, TransactionCategoryRowUpdate};
use super::validation::{
    apply_resolved_parent, apply_resolved_parent_to_changeset, map_category_unique_violation,
    validate_category_update, validate_new_category,
};
use crate::blocking::run_blocking;
use crate::budgets::alerts::{emit_budget_transition_alerts, snapshot_budgets_by_ids};
use crate::budgets::category_impact::{affected_budgets_for_update, analyze_deletion};
use crate::budgets::projection::{rebuild_budget_projections, refresh_active_budget_projections};
use crate::connection::{DbPool, get_connection};
use crate::errors::{IntoCore, IntoStorage, StorageError};
use crate::schema::{transaction_categories, transactions};
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::{
    CommittedOutcome, DomainAlertEventPublisher, publish_created_alerts,
};
use zai_core::features::transaction_categories::models::{
    CategoryChildrenDeleteStrategy, NewTransactionCategory, TransactionCategory,
    TransactionCategoryUpdate,
};
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;
use zai_core::{Error, Result};

fn category_from_row(row: TransactionCategoryRow) -> crate::errors::Result<TransactionCategory> {
    row.try_into().map_err(StorageError::CoreError)
}

fn category_from_rows(
    row: TransactionCategoryRow,
    parent_row: Option<TransactionCategoryRow>,
) -> crate::errors::Result<TransactionCategory> {
    let mut category = category_from_row(row)?;
    if let Some(parent_row) = parent_row {
        let parent = category_from_row(parent_row)?;
        category.role = parent.role;
        category.parent = Some(Box::new(parent));
    }
    Ok(category)
}

pub struct TransactionCategoriesRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
    clock: Arc<dyn CalendarClock>,
    alert_publisher: Arc<dyn DomainAlertEventPublisher>,
}

impl TransactionCategoriesRepository {
    #[cfg(test)]
    pub(crate) fn new(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
    ) -> Self {
        Self::new_with_clock_and_publisher(
            pool,
            writer,
            Arc::new(zai_core::features::budgets::traits::LocalCalendarClock),
            zai_core::features::domain_alerts::DomainAlertEventBus::new(),
        )
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn new_with_clock(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
        clock: Arc<dyn CalendarClock>,
    ) -> Self {
        Self::new_with_clock_and_publisher(
            pool,
            writer,
            clock,
            zai_core::features::domain_alerts::DomainAlertEventBus::new(),
        )
    }

    pub(crate) fn new_with_clock_and_publisher(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
        clock: Arc<dyn CalendarClock>,
        alert_publisher: Arc<dyn DomainAlertEventPublisher>,
    ) -> Self {
        Self {
            pool,
            writer,
            clock,
            alert_publisher,
        }
    }
}

#[async_trait]
impl TransactionCategoriesRepositoryTrait for TransactionCategoriesRepository {
    async fn get_categories(&self, parent_id: Option<&str>) -> Result<Vec<TransactionCategory>> {
        let pool = Arc::clone(&self.pool);
        let parent_id = parent_id.map(str::to_owned);
        run_blocking(move || {
            let conn = &mut get_connection(&pool)?;

            let parent_categories = diesel::alias!(transaction_categories as parent_categories);
            let mut query = transaction_categories::table
                .left_join(
                    parent_categories.on(transaction_categories::parent_id.eq(parent_categories
                        .field(transaction_categories::id)
                        .nullable())),
                )
                .filter(transaction_categories::deleted_at.is_null())
                .into_boxed();

            if let Some(ref pid) = parent_id {
                query = query.filter(transaction_categories::parent_id.eq(pid));
            }

            let results = query
                .load::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
                .into_core()?;

            let categories = results
                .into_iter()
                .map(|(row, parent_row)| category_from_rows(row, parent_row))
                .collect::<crate::errors::Result<Vec<_>>>()?;

            Ok(categories)
        })
        .await
    }

    async fn get_category(&self, id: &str) -> Result<TransactionCategory> {
        let pool = Arc::clone(&self.pool);
        let id = id.to_owned();
        run_blocking(move || {
            let conn = &mut get_connection(&pool)?;

            let parent_categories = diesel::alias!(transaction_categories as parent_categories);

            let (category_row, parent_row) = transaction_categories::table
                .left_join(
                    parent_categories.on(transaction_categories::parent_id.eq(parent_categories
                        .field(transaction_categories::id)
                        .nullable())),
                )
                .filter(transaction_categories::id.eq(&id))
                .filter(transaction_categories::deleted_at.is_null())
                .first::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
                .into_core()?;

            category_from_rows(category_row, parent_row).map_err(StorageError::into)
        })
        .await
    }

    async fn category_has_children(&self, id: &str) -> Result<bool> {
        let pool = Arc::clone(&self.pool);
        let id = id.to_owned();
        run_blocking(move || {
            let conn = &mut get_connection(&pool)?;

            let child_count = transaction_categories::table
                .filter(transaction_categories::parent_id.eq(id))
                .filter(transaction_categories::deleted_at.is_null())
                .count()
                .get_result::<i64>(conn)
                .into_core()?;

            Ok(child_count > 0)
        })
        .await
    }

    async fn sibling_name_exists(
        &self,
        parent_id: Option<&str>,
        name: &str,
        excluded_id: Option<&str>,
    ) -> Result<bool> {
        let pool = Arc::clone(&self.pool);
        let parent_id = parent_id.map(str::to_owned);
        let name = name.to_owned();
        let excluded_id = excluded_id.map(str::to_owned);
        run_blocking(move || {
            let conn = &mut get_connection(&pool)?;
            let normalized_name = name.trim().to_lowercase();

            let mut query = transaction_categories::table
                .filter(transaction_categories::deleted_at.is_null())
                .into_boxed();

            query = match parent_id.as_deref() {
                Some(parent_id) => query.filter(transaction_categories::parent_id.eq(parent_id)),
                None => query.filter(transaction_categories::parent_id.is_null()),
            };

            if let Some(excluded_id) = excluded_id.as_deref() {
                query = query.filter(transaction_categories::id.ne(excluded_id));
            }

            let sibling_names = query
                .select(transaction_categories::name)
                .load::<String>(conn)
                .into_core()?;

            Ok(sibling_names
                .iter()
                .any(|sibling_name| sibling_name.trim().to_lowercase() == normalized_name))
        })
        .await
    }

    async fn create_category(
        &self,
        new_category: NewTransactionCategory,
    ) -> Result<TransactionCategory> {
        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<TransactionCategory> {
                    let mut category: TransactionCategoryRow = new_category.into();
                    let resolved_parent =
                        validate_new_category(conn, category.parent_id.as_deref(), &category.name)?;
                    apply_resolved_parent(&mut category, resolved_parent);

                    diesel::insert_into(transaction_categories::table)
                        .values(&category)
                        .execute(conn)
                        .into_storage()
                        .map_err(map_category_unique_violation)?;

                    let parent_categories =
                        diesel::alias!(transaction_categories as parent_categories);

                    let (category_row, parent_row) = transaction_categories::table
                        .left_join(
                            parent_categories.on(transaction_categories::parent_id.eq(
                                parent_categories
                                    .field(transaction_categories::id)
                                    .nullable(),
                            )),
                        )
                        .filter(transaction_categories::id.eq(&category.id))
                        .first::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
                        .into_storage()?;

                    let category = category_from_rows(category_row, parent_row)?;
                    Ok(category)
                },
            )
            .await
    }

    async fn update_category(
        &self,
        updated_category: TransactionCategoryUpdate,
    ) -> Result<TransactionCategory> {
        let now = self.clock.sample();
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<
                    CommittedOutcome<TransactionCategory>,
                > {
                    let category_id = updated_category.id.clone();
                    let mut changeset: TransactionCategoryRowUpdate = updated_category.clone().into();
                    changeset.updated_at = now;

                    let existing = transaction_categories::table
                        .find(&category_id)
                        .first::<TransactionCategoryRow>(conn)
                        .into_storage()?;
                    let resolved_parent = validate_category_update(
                        conn,
                        &category_id,
                        changeset.parent_id.as_deref(),
                        &changeset.name,
                    )?;
                    apply_resolved_parent_to_changeset(&mut changeset, resolved_parent);
                    let structural_change =
                        existing.parent_id != changeset.parent_id || existing.role != changeset.role;
                    let affected_budgets = if structural_change {
                        refresh_active_budget_projections(conn, now)?;
                        affected_budgets_for_update(
                            conn,
                            &category_id,
                            existing.parent_id.as_deref(),
                            changeset.parent_id.as_deref(),
                            existing.role.parse().map_err(|_| {
                                StorageError::CoreError(Error::Repository(
                                    "Invalid category role".to_string(),
                                ))
                            })?,
                            changeset.role.parse().map_err(|_| {
                                StorageError::CoreError(Error::Repository(
                                    "Invalid category role".to_string(),
                                ))
                            })?,
                            now,
                        )?
                    } else {
                        Vec::new()
                    };

                    if structural_change
                        && !affected_budgets.is_empty()
                        && !updated_category.confirm_budget_impact
                    {
                        return Err(StorageError::CoreError(
                            Error::BudgetImpactConfirmationRequired { affected_budgets },
                        ));
                    }

                    let affected_ids = affected_budgets
                        .iter()
                        .map(|budget| budget.id.clone())
                        .collect::<Vec<_>>();
                    let before = snapshot_budgets_by_ids(conn, &affected_ids, now)?;

                    diesel::update(transaction_categories::table.find(&category_id))
                        .set(&changeset)
                        .execute(conn)
                        .into_storage()
                        .map_err(map_category_unique_violation)?;

                    if changeset.parent_id.is_none() {
                        diesel::update(
                            transaction_categories::table
                                .filter(transaction_categories::parent_id.eq(&category_id))
                                .filter(transaction_categories::deleted_at.is_null()),
                        )
                        .set((
                            transaction_categories::role.eq(&changeset.role),
                            transaction_categories::updated_at.eq(changeset.updated_at),
                        ))
                        .execute(conn)
                        .into_storage()?;
                    }

                    let parent_categories =
                        diesel::alias!(transaction_categories as parent_categories);

                    let (category_row, parent_row) = transaction_categories::table
                        .left_join(
                            parent_categories.on(
                                transaction_categories::parent_id.eq(parent_categories
                                    .field(transaction_categories::id)
                                    .nullable()),
                            ),
                        )
                        .filter(transaction_categories::id.eq(&category_id))
                        .first::<(TransactionCategoryRow, Option<TransactionCategoryRow>)>(conn)
                        .into_storage()?;

                    let category = category_from_rows(category_row, parent_row)?;
                    if structural_change {
                        rebuild_budget_projections(conn, &affected_ids)?;
                    }
                    let after = snapshot_budgets_by_ids(conn, &affected_ids, now)?;
                    let alerts = if structural_change {
                        emit_budget_transition_alerts(
                            conn,
                            BudgetAlertMode::Transition,
                            &before,
                            &after,
                        )?
                    } else {
                        Vec::new()
                    };
                    Ok(CommittedOutcome::with_alert_outcomes(category, alerts))
                },
            )
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn delete_categories(
        &self,
        ids: Vec<&str>,
        children_strategy: CategoryChildrenDeleteStrategy,
        confirm_budget_impact: bool,
    ) -> Result<Vec<TransactionCategory>> {
        let owned_ids = ids.iter().map(|&s| s.to_string()).collect::<Vec<String>>();
        let now = self.clock.sample();
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<
                    CommittedOutcome<Vec<TransactionCategory>>,
                > {
                    refresh_active_budget_projections(conn, now)?;
                    let impact = analyze_deletion(
                        conn,
                        &owned_ids,
                        children_strategy,
                        now,
                    )?;
                    if !impact.blocked_category_ids.is_empty() {
                        return Err(StorageError::CoreError(Error::CategoryDeletionBlocked {
                            category_ids: impact.blocked_category_ids,
                            affected_budgets: impact.affected_budgets,
                        }));
                    }
                    if !impact.affected_budgets.is_empty() && !confirm_budget_impact {
                        return Err(StorageError::CoreError(
                            Error::BudgetImpactConfirmationRequired {
                                affected_budgets: impact.affected_budgets,
                            },
                        ));
                    }
                    let affected_ids = impact
                        .affected_budgets
                        .iter()
                        .map(|budget| budget.id.clone())
                        .collect::<Vec<_>>();
                    let before = snapshot_budgets_by_ids(conn, &affected_ids, now)?;
                    let ids_to_delete = impact.ids_to_delete;

                    if children_strategy == CategoryChildrenDeleteStrategy::Promote {
                        diesel::update(
                            transaction_categories::table
                                .filter(transaction_categories::parent_id.eq_any(&owned_ids))
                                .filter(transaction_categories::deleted_at.is_null()),
                        )
                        .set((
                            transaction_categories::parent_id.eq(None::<String>),
                            transaction_categories::updated_at.eq(now),
                        ))
                        .execute(conn)
                        .into_storage()?;
                    }

                    diesel::update(
                        transaction_categories::table
                            .filter(transaction_categories::id.eq_any(&ids_to_delete)),
                    )
                    .set(transaction_categories::deleted_at.eq(now))
                    .execute(conn)
                    .into_storage()?;

                    diesel::update(
                        transactions::table.filter(
                            transactions::transaction_category_id.eq_any(&ids_to_delete),
                        ),
                    )
                    .set((
                        transactions::transaction_category_id.eq(None::<String>),
                        transactions::updated_at.eq(now),
                    ))
                    .execute(conn)
                    .into_storage()?;

                    let deleted = transaction_categories::table
                        .filter(transaction_categories::id.eq_any(&ids_to_delete))
                        .filter(transaction_categories::deleted_at.is_not_null())
                        .load::<TransactionCategoryRow>(conn)
                        .into_storage()?;

                    let categories = deleted
                        .into_iter()
                        .map(category_from_row)
                        .collect::<crate::errors::Result<Vec<_>>>()?;
                    rebuild_budget_projections(conn, &affected_ids)?;
                    let after = snapshot_budgets_by_ids(conn, &affected_ids, now)?;
                    let alerts = emit_budget_transition_alerts(
                        conn,
                        BudgetAlertMode::Transition,
                        &before,
                        &after,
                    )?;
                    Ok(CommittedOutcome::with_alert_outcomes(categories, alerts))
                },
            )
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn import_categories(
        &self,
        new_categories: Vec<NewTransactionCategory>,
    ) -> Result<Vec<TransactionCategory>> {
        if new_categories.is_empty() {
            return Ok(Vec::new());
        }

        self.writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<Vec<TransactionCategory>> {
                    let categories: Vec<TransactionCategoryRow> =
                        new_categories.iter().map(|c| c.clone().into()).collect();

                    diesel::insert_into(transaction_categories::table)
                        .values(&categories)
                        .execute(conn)
                        .into_storage()?;

                    let ids = categories
                        .iter()
                        .map(|c| c.id.clone())
                        .collect::<Vec<String>>();

                    let inserted = transaction_categories::table
                        .filter(transaction_categories::id.eq_any(&ids))
                        .load::<TransactionCategoryRow>(conn)
                        .into_storage()?;

                    let inserted = inserted
                        .into_iter()
                        .map(category_from_row)
                        .collect::<crate::errors::Result<Vec<_>>>()?;
                    Ok(inserted)
                },
            )
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::budgets::BudgetsRepository;
    use crate::connection::run_migrations;
    use crate::test_utils::TempDb;
    use crate::write_actor::spawn_writer;
    use uuid::Uuid;
    use zai_core::features::budgets::models::{
        BudgetCadence, BudgetMeasurementMode, BudgetRolloverMode, NewBudget,
    };
    use zai_core::features::budgets::traits::BudgetsRepositoryTrait;
    use zai_core::features::transaction_categories::models::{
        CategoryRole, NewTransactionCategory, TransactionCategory,
    };
    use zai_core::features::transactions::models::NewTransaction;

    fn setup_test_repo(db_path: &str) -> TransactionCategoriesRepository {
        let manager = r2d2::ConnectionManager::<SqliteConnection>::new(db_path);
        let pool = Pool::builder()
            .build(manager)
            .expect("Failed to create pool");

        run_migrations(&pool.clone()).unwrap();

        let writer = spawn_writer(pool.clone()).unwrap();

        TransactionCategoriesRepository::new(Arc::new(pool), writer)
    }

    fn insert_transaction_with_category(repo: &TransactionCategoriesRepository, category_id: &str) {
        let conn = &mut get_connection(&repo.pool).unwrap();
        let transaction = NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some("Lunch".to_string()),
            amount: 1200,
            transaction_date: chrono::Utc::now().naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: Some(category_id.to_string()),
            notes: None,
        };

        diesel::insert_into(transactions::table)
            .values((
                transactions::id.eq(transaction.id.unwrap()),
                transactions::description.eq(transaction.description),
                transactions::amount.eq(transaction.amount),
                transactions::transaction_date.eq(transaction.transaction_date),
                transactions::transaction_type.eq(transaction.transaction_type),
                transactions::transaction_category_id.eq(transaction.transaction_category_id),
                transactions::notes.eq(transaction.notes),
            ))
            .execute(conn)
            .unwrap();
    }

    fn new_scoped_budget(category_id: &str) -> NewBudget {
        NewBudget {
            id: Some("budget-1".to_string()),
            name: "Food budget".to_string(),
            base_allowance: 10_000,
            cadence: Some(BudgetCadence::Month),
            category_ids: vec![category_id.to_string()],
            measurement_mode: Some(BudgetMeasurementMode::Spending),
            rollover_mode: Some(BudgetRolloverMode::Off),
            warning_percentage: Some(80),
        }
    }

    #[tokio::test]
    async fn test_get_categories() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let cat1 = NewTransactionCategory {
            name: "Cat 1".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let cat2 = NewTransactionCategory {
            name: "Cat 2".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let cat3 = NewTransactionCategory {
            name: "Cat 3".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };

        repo.create_category(cat1).await.unwrap();
        repo.create_category(cat2).await.unwrap();
        let created = repo.create_category(cat3).await.unwrap();
        repo.delete_categories(
            vec![&created.id],
            CategoryChildrenDeleteStrategy::Block,
            false,
        )
        .await
        .unwrap();

        let all = repo.get_categories(None).await.unwrap();
        assert!(all.len() == 2);
    }

    #[tokio::test]
    async fn test_get_category() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let parent = repo.create_category(parent).await.unwrap();

        let child = NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let child = repo.create_category(child).await.unwrap();

        let category = repo.get_category(&child.id).await.unwrap();
        assert_eq!(category.id, child.id);
        assert_eq!(category.parent.unwrap().id, parent.id);
    }

    #[tokio::test]
    async fn test_get_categories_by_parent_id() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        // Create a parent first
        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let parent = repo.create_category(parent).await.unwrap();

        let cat1 = NewTransactionCategory {
            name: "Cat 1".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let cat2 = NewTransactionCategory {
            name: "Cat 2".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let cat3 = NewTransactionCategory {
            name: "Cat 3".to_string(),
            parent_id: Some(parent.id.clone()),
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };

        repo.create_category(cat1).await.unwrap();
        repo.create_category(cat2).await.unwrap();
        let created = repo.create_category(cat3).await.unwrap();
        repo.delete_categories(
            vec![&created.id],
            CategoryChildrenDeleteStrategy::Block,
            false,
        )
        .await
        .unwrap();

        let all = repo.get_categories(Some(&parent.id)).await.unwrap();
        assert!(all.len() == 1);
        assert!(all[0].name == "Cat 1");
    }

    #[tokio::test]
    async fn test_create_category() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category = NewTransactionCategory {
            name: "Test Category".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };

        let created: TransactionCategory = repo.create_category(new_category).await.unwrap();

        assert!(!created.id.is_empty());
        assert_eq!(created.name, "Test Category");
        assert_eq!(created.description.as_deref(), Some("Descrizione test"));
        assert_eq!(created.color.as_deref(), Some("#FF0000"));
    }

    #[tokio::test]
    async fn test_update_category() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category = NewTransactionCategory {
            name: "Original".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created = repo.create_category(new_category).await.unwrap();

        let updated = TransactionCategoryUpdate {
            id: created.id,
            name: "Updated".to_string(),
            parent_id: None,
            description: Some("Updated description".to_string()),
            color: Some("#3C99F6".to_string()),
            role: None,
            confirm_budget_impact: false,
        };

        let updated_category = repo.update_category(updated).await.unwrap();

        assert_eq!(updated_category.name, "Updated");
        assert_eq!(
            updated_category.description.as_deref(),
            Some("Updated description")
        );
        assert_eq!(updated_category.color.as_deref(), Some("#3C99F6"));
    }

    #[tokio::test]
    async fn updating_a_root_role_updates_child_effective_roles() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = repo
            .create_category(NewTransactionCategory {
                name: "Salary".to_string(),
                parent_id: None,
                description: None,
                color: None,
                role: Some(CategoryRole::Income),
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();
        let child = repo
            .create_category(NewTransactionCategory {
                name: "Bonus".to_string(),
                parent_id: Some(parent.id.clone()),
                description: None,
                color: None,
                role: Some(CategoryRole::Income),
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();

        repo.update_category(TransactionCategoryUpdate {
            id: parent.id,
            name: "Salary".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        })
        .await
        .unwrap();

        assert_eq!(
            repo.get_category(&child.id).await.unwrap().role,
            CategoryRole::Spending
        );
    }

    #[tokio::test]
    async fn update_category_promotes_child_to_root_in_database() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = repo
            .create_category(NewTransactionCategory {
                name: "Parent".to_string(),
                parent_id: None,
                description: None,
                color: Some("#D31212".to_string()),
                role: Some(CategoryRole::Spending),
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();
        let child = repo
            .create_category(NewTransactionCategory {
                name: "Child".to_string(),
                parent_id: Some(parent.id.clone()),
                description: None,
                color: Some("#DB1313".to_string()),
                role: None,
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();

        let updated = repo
            .update_category(TransactionCategoryUpdate {
                id: child.id.clone(),
                name: "Promoted Child".to_string(),
                parent_id: None,
                description: None,
                color: Some("#AB63F2".to_string()),
                role: Some(CategoryRole::Spending),
                confirm_budget_impact: false,
            })
            .await
            .unwrap();

        assert_eq!(updated.parent_id, None);
        assert_eq!(repo.get_category(&child.id).await.unwrap().parent_id, None);
    }

    #[tokio::test]
    async fn update_category_clears_root_color_in_database() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let created = repo
            .create_category(NewTransactionCategory {
                name: "Original".to_string(),
                parent_id: None,
                description: None,
                color: Some("#D31212".to_string()),
                role: Some(CategoryRole::Spending),
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();

        let updated = repo
            .update_category(TransactionCategoryUpdate {
                id: created.id.clone(),
                name: "Original".to_string(),
                parent_id: None,
                description: None,
                color: None,
                role: Some(CategoryRole::Spending),
                confirm_budget_impact: false,
            })
            .await
            .unwrap();

        assert_eq!(updated.color, None);
        assert_eq!(repo.get_category(&created.id).await.unwrap().color, None);
    }

    #[tokio::test]
    async fn update_category_clears_description_in_database() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let created = repo
            .create_category(NewTransactionCategory {
                name: "Original".to_string(),
                parent_id: None,
                description: Some("Original description".to_string()),
                color: Some("#D31212".to_string()),
                role: Some(CategoryRole::Spending),
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();

        let updated = repo
            .update_category(TransactionCategoryUpdate {
                id: created.id.clone(),
                name: "Original".to_string(),
                parent_id: None,
                description: None,
                color: Some("#D31212".to_string()),
                role: Some(CategoryRole::Spending),
                confirm_budget_impact: false,
            })
            .await
            .unwrap();

        assert_eq!(updated.description, None);
        assert_eq!(
            repo.get_category(&created.id).await.unwrap().description,
            None
        );
    }

    #[tokio::test]
    async fn test_delete_categories() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category_1 = NewTransactionCategory {
            name: "To Delete".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_1 = repo.create_category(new_category_1).await.unwrap();

        let new_category_2 = NewTransactionCategory {
            name: "To Delete Too".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_2 = repo.create_category(new_category_2).await.unwrap();

        let deleted = repo
            .delete_categories(
                vec![&created_1.id, &created_2.id],
                CategoryChildrenDeleteStrategy::Block,
                false,
            )
            .await
            .unwrap();

        assert_eq!(deleted.len(), 2);
    }

    #[tokio::test]
    async fn test_import_categories() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let new_category_1 = NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            name: "Test Category 1".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            role: None,
        };

        let new_category_2 = NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            name: "Test Category 2".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            role: None,
        };

        let new_category_3 = NewTransactionCategory {
            id: Some(Uuid::new_v4().to_string()),
            name: "Test Category 3".to_string(),
            parent_id: Some(new_category_1.id.as_deref().unwrap().to_string()),
            description: Some("Descrizione test".to_string()),
            color: Some("#DB1313".to_string()),
            role: None,
        };

        let created: Vec<TransactionCategory> = repo
            .import_categories(vec![new_category_1, new_category_2, new_category_3])
            .await
            .unwrap();

        assert_eq!(created.len(), 3);
        assert!(
            created
                .iter()
                .any(|category| category.color.as_deref() == Some("#DB1313"))
        );
    }

    #[tokio::test]
    async fn test_create_category_preserves_child_color() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_parent = repo.create_category(parent).await.unwrap();

        let child = NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(created_parent.id.clone()),
            description: None,
            color: Some("#3C99F6".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_child = repo.create_category(child).await.unwrap();

        assert_eq!(created_child.color.as_deref(), Some("#3C99F6"));
    }

    #[tokio::test]
    async fn test_create_category_preserves_missing_child_color() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_parent = repo.create_category(parent).await.unwrap();

        let child = NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(created_parent.id),
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_child = repo.create_category(child).await.unwrap();

        assert_eq!(created_child.color, None);
    }

    #[tokio::test]
    async fn test_update_category_preserves_child_color() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_parent = repo.create_category(parent).await.unwrap();

        let child = NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(created_parent.id.clone()),
            description: None,
            color: Some("#DB1313".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_child = repo.create_category(child).await.unwrap();

        let updated_child = TransactionCategoryUpdate {
            id: created_child.id,
            name: "Child Updated".to_string(),
            parent_id: Some(created_parent.id),
            description: None,
            color: Some("#AB63F2".to_string()),
            role: None,
            confirm_budget_impact: false,
        };

        let updated_child = repo.update_category(updated_child).await.unwrap();

        assert_eq!(updated_child.color.as_deref(), Some("#AB63F2"));
    }

    #[tokio::test]
    async fn test_update_category_keeps_root_color_when_parent_is_removed() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = NewTransactionCategory {
            name: "Parent".to_string(),
            parent_id: None,
            description: None,
            color: Some("#D31212".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_parent = repo.create_category(parent).await.unwrap();

        let child = NewTransactionCategory {
            name: "Child".to_string(),
            parent_id: Some(created_parent.id.clone()),
            description: None,
            color: Some("#DB1313".to_string()),
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        };
        let created_child = repo.create_category(child).await.unwrap();

        let updated_child = TransactionCategoryUpdate {
            id: created_child.id,
            name: "Promoted Child".to_string(),
            parent_id: None,
            description: None,
            color: Some("#AB63F2".to_string()),
            role: None,
            confirm_budget_impact: false,
        };

        let updated_child = repo.update_category(updated_child).await.unwrap();

        assert_eq!(updated_child.color.as_deref(), Some("#AB63F2"));
    }

    #[tokio::test]
    async fn test_sibling_name_exists_compares_trimmed_names_case_insensitively() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        repo.create_category(NewTransactionCategory {
            name: "Food".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some(Uuid::new_v4().to_string()),
        })
        .await
        .unwrap();

        let exists = repo
            .sibling_name_exists(None, " food ", None)
            .await
            .expect("check sibling name");

        assert!(exists);
    }

    #[tokio::test]
    async fn test_delete_parent_category_promotes_children() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = repo
            .create_category(NewTransactionCategory {
                name: "Parent".to_string(),
                parent_id: None,
                description: None,
                color: None,
                role: None,
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();
        let child = repo
            .create_category(NewTransactionCategory {
                name: "Child".to_string(),
                parent_id: Some(parent.id.clone()),
                description: None,
                color: None,
                role: None,
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();

        repo.delete_categories(
            vec![&parent.id],
            CategoryChildrenDeleteStrategy::Promote,
            false,
        )
        .await
        .unwrap();
        let promoted = repo.get_category(&child.id).await.unwrap();

        assert!(promoted.parent_id.is_none());
    }

    #[tokio::test]
    async fn test_delete_parent_category_deletes_children() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let parent = repo
            .create_category(NewTransactionCategory {
                name: "Parent".to_string(),
                parent_id: None,
                description: None,
                color: None,
                role: None,
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();
        let child = repo
            .create_category(NewTransactionCategory {
                name: "Child".to_string(),
                parent_id: Some(parent.id.clone()),
                description: None,
                color: None,
                role: None,
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();

        let deleted = repo
            .delete_categories(
                vec![&parent.id],
                CategoryChildrenDeleteStrategy::Delete,
                false,
            )
            .await
            .unwrap();

        assert!(deleted.iter().any(|category| category.id == child.id));
    }

    #[tokio::test]
    async fn test_delete_category_uncategorizes_transactions() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let category = repo
            .create_category(NewTransactionCategory {
                name: "Food".to_string(),
                parent_id: None,
                description: None,
                color: None,
                role: None,
                id: Some(Uuid::new_v4().to_string()),
            })
            .await
            .unwrap();
        insert_transaction_with_category(&repo, &category.id);

        repo.delete_categories(
            vec![&category.id],
            CategoryChildrenDeleteStrategy::Block,
            false,
        )
        .await
        .unwrap();
        let conn = &mut get_connection(&repo.pool).unwrap();
        let category_id = transactions::table
            .select(transactions::transaction_category_id)
            .first::<Option<String>>(conn)
            .unwrap();

        assert!(category_id.is_none());
    }

    #[tokio::test]
    async fn role_changes_require_confirmation_when_budget_scope_is_affected() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());
        let budgets = BudgetsRepository::new(Arc::clone(&repo.pool), repo.writer.clone());
        let category = repo
            .create_category(NewTransactionCategory {
                name: "Food".to_string(),
                parent_id: None,
                description: None,
                color: None,
                role: Some(CategoryRole::Spending),
                id: Some("food".to_string()),
            })
            .await
            .expect("category");
        budgets
            .create_budget(new_scoped_budget(&category.id))
            .await
            .expect("budget");

        let update = |confirm_budget_impact| TransactionCategoryUpdate {
            id: category.id.clone(),
            parent_id: None,
            name: "Food".to_string(),
            description: None,
            color: None,
            role: Some(CategoryRole::Income),
            confirm_budget_impact,
        };

        let error = repo
            .update_category(update(false))
            .await
            .expect_err("role change should require confirmation");
        assert!(matches!(
            error,
            Error::BudgetImpactConfirmationRequired { .. }
        ));
        assert_eq!(
            repo.get_category(&category.id).await.unwrap().role,
            CategoryRole::Spending
        );

        repo.update_category(update(true))
            .await
            .expect("confirmed role change");
        assert_eq!(
            repo.get_category(&category.id).await.unwrap().role,
            CategoryRole::Income
        );
    }

    #[tokio::test]
    async fn direct_current_budget_selection_blocks_category_deletion() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());
        let budgets = BudgetsRepository::new(Arc::clone(&repo.pool), repo.writer.clone());
        let category = repo
            .create_category(NewTransactionCategory {
                name: "Food".to_string(),
                parent_id: None,
                description: None,
                color: None,
                role: Some(CategoryRole::Spending),
                id: Some("food".to_string()),
            })
            .await
            .expect("category");
        budgets
            .create_budget(new_scoped_budget(&category.id))
            .await
            .expect("budget");

        let error = repo
            .delete_categories(
                vec![&category.id],
                CategoryChildrenDeleteStrategy::Block,
                true,
            )
            .await
            .expect_err("direct selection should block deletion");
        assert!(matches!(error, Error::CategoryDeletionBlocked { .. }));
        assert!(repo.get_category(&category.id).await.is_ok());
    }

    #[tokio::test]
    async fn indirectly_covered_deletion_requires_confirmation_then_rebuilds_budget() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());
        let budgets = BudgetsRepository::new(Arc::clone(&repo.pool), repo.writer.clone());
        let root = repo
            .create_category(NewTransactionCategory {
                name: "Food".to_string(),
                parent_id: None,
                description: None,
                color: None,
                role: Some(CategoryRole::Spending),
                id: Some("food".to_string()),
            })
            .await
            .expect("root");
        let child = repo
            .create_category(NewTransactionCategory {
                name: "Groceries".to_string(),
                parent_id: Some(root.id.clone()),
                description: None,
                color: None,
                role: None,
                id: Some("groceries".to_string()),
            })
            .await
            .expect("child");
        let mut budget = new_scoped_budget(&root.id);
        budget.id = Some("budget-2".to_string());
        budgets.create_budget(budget).await.expect("budget");

        let error = repo
            .delete_categories(
                vec![&child.id],
                CategoryChildrenDeleteStrategy::Block,
                false,
            )
            .await
            .expect_err("indirect coverage should require confirmation");
        assert!(matches!(
            error,
            Error::BudgetImpactConfirmationRequired { .. }
        ));

        repo.delete_categories(vec![&child.id], CategoryChildrenDeleteStrategy::Block, true)
            .await
            .expect("confirmed deletion");
        assert!(repo.get_category(&child.id).await.is_err());
        assert!(repo.get_category(&root.id).await.is_ok());
    }
}

#[cfg(test)]
#[path = "repository_concurrency_tests.rs"]
mod repository_concurrency_tests;
