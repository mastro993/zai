use super::bulk_ops;
use super::import_dedup;
use super::models::{TransactionRow, TransactionRowUpdate};
use super::query::{
    apply_transaction_filters, apply_transaction_sort, count_transactions, transactions_base_query,
};
use crate::budgets::alerts::{emit_budget_transition_alerts, snapshot_active_budgets};
use crate::budgets::repair_transaction_budget_projections;
use crate::connection::{DbPool, get_connection};
use crate::errors::{IntoCore, IntoStorage, StorageError};
use crate::pagination::{Paginate, total_pages};
use crate::schema::{transaction_categories, transactions};
use crate::transaction_categories::models::TransactionCategoryRow;
use crate::write_actor::WriteHandle;
use async_trait::async_trait;
use chrono::Local;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::budgets::alerts::BudgetAlertMode;
use zai_core::features::budgets::traits::CalendarClock;
use zai_core::features::domain_alerts::{
    CommittedOutcome, DomainAlertEventPublisher, publish_created_alerts,
};
use zai_core::features::transaction_categories::models::{
    NewTransactionCategory, TransactionCategory,
};
use zai_core::features::transactions::models::{
    DuplicateKeyCandidate, NewTransaction, Transaction, TransactionSearchFilters, TransactionUpdate,
};
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;
use zai_core::query::{PaginatedData, Sort};

fn load_existing_in_import_range(
    conn: &mut SqliteConnection,
    candidates: &[NewTransaction],
) -> crate::errors::Result<Vec<TransactionRow>> {
    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    let (range_start, range_end_exclusive) = import_dedup::import_half_open_date_range(candidates);
    transactions::table
        .filter(transactions::deleted_at.is_null())
        .filter(transactions::transaction_date.ge(range_start))
        .filter(transactions::transaction_date.lt(range_end_exclusive))
        .load::<TransactionRow>(conn)
        .into_storage()
}

fn prepare_import_rows(
    candidates: Vec<NewTransaction>,
    existing_rows: &[TransactionRow],
) -> Vec<TransactionRow> {
    import_dedup::filter_import_duplicates(candidates, existing_rows)
        .into_iter()
        .map(Into::into)
        .collect()
}

pub struct TransactionsRepository {
    pool: Arc<DbPool>,
    writer: WriteHandle,
    clock: Arc<dyn CalendarClock>,
    alert_publisher: Arc<dyn DomainAlertEventPublisher>,
}

impl TransactionsRepository {
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
impl TransactionsRepositoryTrait for TransactionsRepository {
    fn get_transactions(
        &self,
        page: i64,
        per_page: i64,
        filters: Option<TransactionSearchFilters>,
        sort: Option<Sort>,
    ) -> Result<PaginatedData<Transaction>> {
        let conn = &mut get_connection(&self.pool)?;

        let total = count_transactions(conn, filters.as_ref()).into_core()?;
        let total_pages = total_pages(total, per_page);

        let query = apply_transaction_sort(
            apply_transaction_filters(transactions_base_query(), filters.as_ref()),
            sort.as_ref(),
        );

        let page_rows = query
            .select(transactions::all_columns)
            .paginate(page)
            .into_core()?
            .per_page(per_page)
            .into_core()?
            .load_page::<TransactionRow>(conn)
            .into_core()?;

        let data = page_rows.into_iter().map(Transaction::from).collect();

        Ok(PaginatedData {
            data,
            page,
            per_page,
            total_pages,
        })
    }

    fn get_transaction(&self, id: &str) -> Result<Transaction> {
        let mut conn = get_connection(&self.pool)?;

        let result = transactions::table
            .filter(transactions::deleted_at.is_null())
            .find(id)
            .first::<TransactionRow>(&mut conn)
            .into_core()?;

        Ok(result.into())
    }

    fn get_filtered_transaction_ids(
        &self,
        filters: Option<TransactionSearchFilters>,
        sort: Option<Sort>,
    ) -> Result<Vec<String>> {
        let conn = &mut get_connection(&self.pool)?;
        bulk_ops::get_filtered_transaction_ids(conn, filters.as_ref(), sort.as_ref())
    }

    fn export_transactions_csv(
        &self,
        filters: Option<TransactionSearchFilters>,
        transaction_ids: Option<Vec<String>>,
    ) -> Result<String> {
        let conn = &mut get_connection(&self.pool)?;
        bulk_ops::export_transactions_csv(conn, filters.as_ref(), transaction_ids.as_deref())
    }

    fn find_existing_duplicate_keys(
        &self,
        candidates: Vec<DuplicateKeyCandidate>,
    ) -> Result<Vec<String>> {
        let conn = &mut get_connection(&self.pool)?;
        bulk_ops::find_existing_duplicate_keys(conn, &candidates)
    }

    async fn create_transaction(&self, new_transaction: NewTransaction) -> Result<Transaction> {
        let clock = Arc::clone(&self.clock);
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<
                    CommittedOutcome<Transaction>,
                > {
                    let now = clock.sample();
                    let before = snapshot_active_budgets(conn, now)?;
                    let transaction: TransactionRow = new_transaction.into();
                    let transaction_id = transaction.id.clone();

                    diesel::insert_into(transactions::table)
                        .values(&transaction)
                        .execute(conn)
                        .into_storage()?;

                    let inserted = transactions::table
                        .filter(transactions::id.eq(&transaction_id))
                        .first::<TransactionRow>(conn)
                        .into_storage()?;

                    repair_transaction_budget_projections(
                        conn,
                        now,
                        &[],
                        std::slice::from_ref(&inserted),
                    )?;
                    let after = snapshot_active_budgets(conn, now)?;
                    let alerts = emit_budget_transition_alerts(
                        conn,
                        BudgetAlertMode::Transition,
                        &before,
                        &after,
                    )?;
                    Ok(CommittedOutcome::with_alert_outcomes(
                        inserted.into(),
                        alerts,
                    ))
                },
            )
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn update_transaction(
        &self,
        updated_transaction: TransactionUpdate,
    ) -> Result<Transaction> {
        let clock = Arc::clone(&self.clock);
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<
                    CommittedOutcome<Transaction>,
                > {
                    let now = clock.sample();
                    let before = snapshot_active_budgets(conn, now)?;
                    let transaction_id = updated_transaction.id.clone();
                    let mut changeset: TransactionRowUpdate = updated_transaction.into();
                    changeset.updated_at = now;

                    let existing = transactions::table
                        .find(&transaction_id)
                        .first::<TransactionRow>(conn)
                        .into_storage()?;

                    diesel::update(transactions::table.find(&transaction_id))
                        .set(&changeset)
                        .execute(conn)
                        .into_storage()?;

                    let persisted = transactions::table
                        .find(&transaction_id)
                        .filter(transactions::deleted_at.is_null())
                        .first::<TransactionRow>(conn)
                        .into_storage()?;

                    repair_transaction_budget_projections(
                        conn,
                        now,
                        std::slice::from_ref(&existing),
                        std::slice::from_ref(&persisted),
                    )?;
                    let after = snapshot_active_budgets(conn, now)?;
                    let alerts = emit_budget_transition_alerts(
                        conn,
                        BudgetAlertMode::Transition,
                        &before,
                        &after,
                    )?;
                    Ok(CommittedOutcome::with_alert_outcomes(persisted.into(), alerts))
                },
            )
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn delete_transaction(&self, id: &str) -> Result<Transaction> {
        let transaction_id = id.to_owned();
        let clock = Arc::clone(&self.clock);
        let publisher = Arc::clone(&self.alert_publisher);

        let outcome = self
            .writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<
                    CommittedOutcome<Transaction>,
                > {
                    let now = clock.sample();
                    let before = snapshot_active_budgets(conn, now)?;
                    let deleted_at = Local::now().naive_utc();

                    let existing = transactions::table
                        .find(&transaction_id)
                        .first::<TransactionRow>(conn)
                        .into_storage()?;

                    diesel::update(transactions::table.find(&transaction_id))
                        .set(transactions::deleted_at.eq(deleted_at))
                        .execute(conn)
                        .into_storage()?;

                    let deleted = transactions::table
                        .find(&transaction_id)
                        .filter(transactions::deleted_at.is_not_null())
                        .first::<TransactionRow>(conn)
                        .into_storage()?;

                    repair_transaction_budget_projections(
                        conn,
                        now,
                        std::slice::from_ref(&existing),
                        std::slice::from_ref(&deleted),
                    )?;
                    let after = snapshot_active_budgets(conn, now)?;
                    let alerts = emit_budget_transition_alerts(
                        conn,
                        BudgetAlertMode::Transition,
                        &before,
                        &after,
                    )?;
                    Ok(CommittedOutcome::with_alert_outcomes(deleted.into(), alerts))
                },
            )
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn delete_transactions(&self, ids: Vec<&str>) -> Result<Vec<Transaction>> {
        let owned_ids = ids.iter().map(|&s| s.to_string()).collect::<Vec<String>>();
        let clock = Arc::clone(&self.clock);
        let publisher = Arc::clone(&self.alert_publisher);

        let outcome = self
            .writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<
                    CommittedOutcome<Vec<Transaction>>,
                > {
                    let now = clock.sample();
                    let before = snapshot_active_budgets(conn, now)?;
                    let deleted_at = Local::now().naive_utc();

                    let existing = transactions::table
                        .filter(transactions::id.eq_any(&owned_ids))
                        .load::<TransactionRow>(conn)
                        .into_storage()?;

                    diesel::update(transactions::table.filter(transactions::id.eq_any(&owned_ids)))
                        .set(transactions::deleted_at.eq(deleted_at))
                        .execute(conn)
                        .into_storage()?;

                    let deleted = transactions::table
                        .filter(transactions::id.eq_any(&owned_ids))
                        .filter(transactions::deleted_at.is_not_null())
                        .load::<TransactionRow>(conn)
                        .into_storage()?;

                    let deleted_transactions: Vec<Transaction> =
                        deleted.iter().cloned().map(Transaction::from).collect();
                    repair_transaction_budget_projections(conn, now, &existing, &deleted)?;
                    let after = snapshot_active_budgets(conn, now)?;
                    let alerts = emit_budget_transition_alerts(
                        conn,
                        BudgetAlertMode::Transition,
                        &before,
                        &after,
                    )?;
                    Ok(CommittedOutcome::with_alert_outcomes(
                        deleted_transactions,
                        alerts,
                    ))
                },
            )
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn import_transactions(
        &self,
        new_transactions: Vec<NewTransaction>,
    ) -> Result<Vec<Transaction>> {
        if new_transactions.is_empty() {
            return Ok(Vec::new());
        }

        let clock = Arc::clone(&self.clock);
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<
                    CommittedOutcome<Vec<Transaction>>,
                > {
                    let existing_rows = load_existing_in_import_range(conn, &new_transactions)?;
                    let transactions_rows =
                        prepare_import_rows(new_transactions, &existing_rows);

                    if transactions_rows.is_empty() {
                        return Ok(CommittedOutcome::with_alert_outcomes(Vec::new(), vec![]));
                    }

                    let now = clock.sample();
                    let before = snapshot_active_budgets(conn, now)?;

                    diesel::insert_into(transactions::table)
                        .values(&transactions_rows)
                        .execute(conn)
                        .into_storage()?;

                    let ids = transactions_rows
                        .iter()
                        .map(|transaction| transaction.id.clone())
                        .collect::<Vec<String>>();

                    let inserted = transactions::table
                        .filter(transactions::id.eq_any(&ids))
                        .load::<TransactionRow>(conn)
                        .into_storage()?;

                    repair_transaction_budget_projections(conn, now, &[], &transactions_rows)?;
                    let after = snapshot_active_budgets(conn, now)?;
                    let alerts = emit_budget_transition_alerts(
                        conn,
                        BudgetAlertMode::Transition,
                        &before,
                        &after,
                    )?;
                    Ok(CommittedOutcome::with_alert_outcomes(
                        inserted.into_iter().map(Transaction::from).collect(),
                        alerts,
                    ))
                },
            )
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }

    async fn import_transactions_with_categories(
        &self,
        new_categories: Vec<NewTransactionCategory>,
        new_transactions: Vec<NewTransaction>,
    ) -> Result<(Vec<TransactionCategory>, Vec<Transaction>)> {
        let clock = Arc::clone(&self.clock);
        let publisher = Arc::clone(&self.alert_publisher);
        let outcome = self
            .writer
            .exec(
                move |conn: &mut SqliteConnection| -> crate::errors::Result<
                    CommittedOutcome<(Vec<TransactionCategory>, Vec<Transaction>)>,
                > {
                    let existing_rows = load_existing_in_import_range(conn, &new_transactions)?;
                    let transactions_rows = prepare_import_rows(new_transactions, &existing_rows);

                    let now = clock.sample();
                    let before = snapshot_active_budgets(conn, now)?;
                    let categories_rows: Vec<TransactionCategoryRow> =
                        new_categories.into_iter().map(Into::into).collect();

                    if !categories_rows.is_empty() {
                        diesel::insert_into(transaction_categories::table)
                            .values(&categories_rows)
                            .execute(conn)
                            .into_storage()?;
                    }

                    if !transactions_rows.is_empty() {
                        diesel::insert_into(transactions::table)
                            .values(&transactions_rows)
                            .execute(conn)
                            .into_storage()?;
                    }

                    let inserted_categories = if categories_rows.is_empty() {
                        Vec::new()
                    } else {
                        let category_ids = categories_rows
                            .iter()
                            .map(|category| category.id.clone())
                            .collect::<Vec<String>>();

                        transaction_categories::table
                            .filter(transaction_categories::id.eq_any(&category_ids))
                            .load::<TransactionCategoryRow>(conn)
                            .into_storage()?
                            .into_iter()
                            .map(|row| row.try_into().map_err(StorageError::CoreError))
                            .collect::<crate::errors::Result<Vec<TransactionCategory>>>()?
                    };

                    let inserted_transactions = if transactions_rows.is_empty() {
                        Vec::new()
                    } else {
                        let transaction_ids = transactions_rows
                            .iter()
                            .map(|transaction| transaction.id.clone())
                            .collect::<Vec<String>>();

                        transactions::table
                            .filter(transactions::id.eq_any(&transaction_ids))
                            .load::<TransactionRow>(conn)
                            .into_storage()?
                            .into_iter()
                            .map(Transaction::from)
                            .collect()
                    };

                    if !transactions_rows.is_empty() {
                        repair_transaction_budget_projections(conn, now, &[], &transactions_rows)?;
                    }
                    let after = snapshot_active_budgets(conn, now)?;
                    let alerts = emit_budget_transition_alerts(
                        conn,
                        BudgetAlertMode::Transition,
                        &before,
                        &after,
                    )?;
                    Ok(CommittedOutcome::with_alert_outcomes(
                        (inserted_categories, inserted_transactions),
                        alerts,
                    ))
                },
            )
            .await?;
        publish_created_alerts(publisher.as_ref(), &outcome);
        Ok(outcome.value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::budgets::BudgetsRepository;
    use crate::connection::run_migrations;
    use crate::schema::transaction_categories;
    use crate::test_utils::TempDb;
    use crate::write_actor::spawn_writer;
    use chrono::NaiveDate;
    use diesel::r2d2::{self, Pool};
    use diesel::sqlite::SqliteConnection;
    use diesel::{Connection, RunQueryDsl, sql_query};
    use std::sync::Arc;
    use uuid::Uuid;
    use zai_core::Error;
    use zai_core::features::budgets::models::NewBudget;
    use zai_core::features::budgets::traits::BudgetsRepositoryTrait;
    use zai_core::features::transaction_categories::models::NewTransactionCategory;

    fn setup_test_repo(db_path: &str) -> TransactionsRepository {
        let manager = r2d2::ConnectionManager::<SqliteConnection>::new(db_path);
        let pool = Pool::builder()
            .build(manager)
            .expect("failed to create pool");

        run_migrations(&pool).expect("failed to run migrations");

        let writer = spawn_writer(pool.clone()).expect("failed to spawn writer");
        TransactionsRepository::new(Arc::new(pool), writer)
    }

    fn parse_datetime(value: &str) -> chrono::NaiveDateTime {
        chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S").expect("valid datetime")
    }

    fn import_candidate(description: &str, amount: i32, value: &str) -> NewTransaction {
        NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some(description.to_string()),
            amount,
            transaction_date: parse_datetime(value),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        }
    }

    #[tokio::test]
    async fn concurrent_identical_imports_commit_one_logical_row() {
        let temp_db = TempDb::new();
        let repo = Arc::new(setup_test_repo(temp_db.path()));

        let (left, right) = tokio::join!(
            repo.import_transactions(vec![import_candidate(
                " Groceries ",
                1250,
                "2026-01-15T08:30:00"
            )]),
            repo.import_transactions(vec![import_candidate(
                "groceries",
                1250,
                "2026-01-15T20:45:00"
            )]),
        );

        let mut imported = left.expect("first import");
        imported.extend(right.expect("second import"));
        assert_eq!(imported.len(), 1);

        let persisted = repo
            .get_transactions(1, 10, None, None)
            .expect("list transactions");
        assert_eq!(persisted.data.len(), 1);
    }

    #[tokio::test]
    async fn import_skips_existing_transaction_in_fractional_last_second() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());
        let day = NaiveDate::from_ymd_opt(2026, 1, 15).expect("date");
        let late = day
            .and_hms_nano_opt(23, 59, 59, 500_000_000)
            .expect("late timestamp");

        repo.create_transaction(NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some("groceries".to_string()),
            amount: 1250,
            transaction_date: late,
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        })
        .await
        .expect("create existing transaction");

        let imported = repo
            .import_transactions(vec![import_candidate(
                " Groceries ",
                1250,
                "2026-01-15T08:30:00",
            )])
            .await
            .expect("import duplicate");

        assert!(imported.is_empty());
    }

    #[tokio::test]
    async fn import_skips_duplicates_within_single_payload() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let imported = repo
            .import_transactions(vec![
                import_candidate(" Groceries ", 1250, "2026-01-15T08:30:00"),
                import_candidate("groceries", 1250, "2026-01-15T20:45:00"),
            ])
            .await
            .expect("import batch");

        assert_eq!(imported.len(), 1);
    }

    #[tokio::test]
    async fn import_keeps_distinct_amounts_and_descriptions() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let imported = repo
            .import_transactions(vec![
                import_candidate("Groceries", 1250, "2026-01-15T08:30:00"),
                import_candidate("Rent", 1250, "2026-01-15T08:30:00"),
                import_candidate("Groceries", 1300, "2026-01-15T08:30:00"),
            ])
            .await
            .expect("import distinct rows");

        assert_eq!(imported.len(), 3);
    }

    #[tokio::test]
    async fn manual_create_still_allows_duplicate_logical_rows() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());
        let shared = NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some(" Groceries ".to_string()),
            amount: 1250,
            transaction_date: parse_datetime("2026-01-15T08:30:00"),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        };

        repo.create_transaction(shared.clone())
            .await
            .expect("first manual create");
        repo.create_transaction(NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            ..shared
        })
        .await
        .expect("second manual create");

        let persisted = repo
            .get_transactions(1, 10, None, None)
            .expect("list transactions");
        assert_eq!(persisted.data.len(), 2);
    }

    #[tokio::test]
    async fn failed_import_budget_repair_rolls_back_inserted_rows() {
        let temp_db = TempDb::new();
        let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
        let pool = Pool::builder().build(manager).expect("pool");
        run_migrations(&pool).expect("migrations");
        let writer = spawn_writer(pool.clone()).expect("writer");
        let pool = Arc::new(pool);
        let budgets = BudgetsRepository::new(Arc::clone(&pool), writer.clone());
        let transactions = TransactionsRepository::new(Arc::clone(&pool), writer);

        budgets
            .create_budget(NewBudget {
                id: Some("import-rollback".to_string()),
                name: "Import rollback".to_string(),
                base_allowance: 10_000,
                cadence: None,
                category_ids: vec![],
                measurement_mode: None,
                rollover_mode: None,
                warning_percentage: Some(80),
            })
            .await
            .expect("budget");

        let mut conn = SqliteConnection::establish(temp_db.path()).expect("database connection");
        sql_query(
            "UPDATE budget_configurations SET category_ids = '[' WHERE budget_id = 'import-rollback'",
        )
        .execute(&mut conn)
        .expect("corrupt configuration");

        let error = transactions
            .import_transactions(vec![import_candidate(
                "Broken import",
                100,
                "2026-07-15T12:00:00",
            )])
            .await
            .expect_err("import repair should fail");
        assert!(matches!(error, Error::Repository(_)));

        let persisted = transactions
            .get_transactions(1, 10, None, None)
            .expect("list transactions");
        assert!(persisted.data.is_empty());
    }

    #[tokio::test]
    async fn import_transactions_with_categories_rolls_back_when_any_transaction_is_invalid() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        let category_id = Uuid::new_v4().to_string();
        let categories = vec![NewTransactionCategory {
            id: Some(category_id.clone()),
            parent_id: None,
            name: "Food".to_string(),
            description: None,
            color: None,
            role: None,
        }];

        let valid_transaction = NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some("Lunch".to_string()),
            amount: 1200,
            transaction_date: chrono::Utc::now().naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: Some(category_id),
            notes: None,
        };
        let invalid_transaction = NewTransaction {
            id: valid_transaction.id.clone(),
            description: Some("Broken".to_string()),
            amount: 800,
            transaction_date: chrono::Utc::now().naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        };

        let result = repo
            .import_transactions_with_categories(
                categories,
                vec![valid_transaction, invalid_transaction],
            )
            .await;

        assert!(result.is_err());

        let conn = &mut get_connection(&repo.pool).expect("connection");
        let persisted_categories = transaction_categories::table
            .count()
            .get_result::<i64>(conn)
            .expect("count categories");
        assert_eq!(persisted_categories, 0);
    }

    fn sample_transaction(description: &str) -> NewTransaction {
        NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some(description.to_string()),
            amount: 1000,
            transaction_date: chrono::Utc::now().naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        }
    }

    fn populated_transaction(category_id: Option<String>) -> NewTransaction {
        NewTransaction {
            id: Some(Uuid::new_v4().to_string()),
            description: Some("Lunch".to_string()),
            amount: 1200,
            transaction_date: chrono::Utc::now().naive_utc(),
            transaction_type: "expense".to_string(),
            transaction_category_id: category_id,
            notes: Some("with friends".to_string()),
        }
    }

    fn update_transaction(
        created: &Transaction,
        description: Option<String>,
        transaction_category_id: Option<String>,
        notes: Option<String>,
    ) -> TransactionUpdate {
        TransactionUpdate {
            id: created.id.clone(),
            description,
            amount: created.amount,
            transaction_date: created.transaction_date,
            transaction_type: created.transaction_type.clone(),
            transaction_category_id,
            notes,
        }
    }

    #[tokio::test]
    async fn update_transaction_clears_description_in_database() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());
        let created = repo
            .create_transaction(populated_transaction(None))
            .await
            .expect("create transaction");

        let updated = repo
            .update_transaction(update_transaction(
                &created,
                None,
                None,
                Some("with friends".to_string()),
            ))
            .await
            .expect("update transaction");

        assert_eq!(updated.description, None);
        assert_eq!(repo.get_transaction(&created.id).unwrap().description, None);
    }

    #[tokio::test]
    async fn update_transaction_clears_notes_in_database() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());
        let created = repo
            .create_transaction(populated_transaction(None))
            .await
            .expect("create transaction");

        let updated = repo
            .update_transaction(update_transaction(
                &created,
                Some("Lunch".to_string()),
                None,
                None,
            ))
            .await
            .expect("update transaction");

        assert_eq!(updated.notes, None);
        assert_eq!(repo.get_transaction(&created.id).unwrap().notes, None);
    }

    #[tokio::test]
    async fn update_transaction_clears_category_in_database() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());
        let category_id = Uuid::new_v4().to_string();
        let created = repo
            .create_transaction(populated_transaction(Some(category_id.clone())))
            .await
            .expect("create transaction");

        let updated = repo
            .update_transaction(update_transaction(
                &created,
                Some("Lunch".to_string()),
                None,
                Some("with friends".to_string()),
            ))
            .await
            .expect("update transaction");

        assert_eq!(updated.transaction_category_id, None);
        assert_eq!(
            repo.get_transaction(&created.id)
                .unwrap()
                .transaction_category_id,
            None
        );
    }

    #[tokio::test]
    async fn update_transaction_clears_all_nullable_fields_in_database() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());
        let category_id = Uuid::new_v4().to_string();
        let created = repo
            .create_transaction(populated_transaction(Some(category_id)))
            .await
            .expect("create transaction");

        let updated = repo
            .update_transaction(update_transaction(&created, None, None, None))
            .await
            .expect("update transaction");

        assert_eq!(updated.description, None);
        assert_eq!(updated.transaction_category_id, None);
        assert_eq!(updated.notes, None);

        let reread = repo.get_transaction(&created.id).unwrap();
        assert_eq!(reread.description, None);
        assert_eq!(reread.transaction_category_id, None);
        assert_eq!(reread.notes, None);
    }

    #[tokio::test]
    async fn update_transaction_leaves_deleted_at_null_for_active_rows() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());
        let created = repo
            .create_transaction(populated_transaction(None))
            .await
            .expect("create transaction");

        repo.update_transaction(update_transaction(&created, None, None, None))
            .await
            .expect("update transaction");

        let conn = &mut get_connection(&repo.pool).expect("connection");
        let deleted_at = transactions::table
            .find(&created.id)
            .select(transactions::deleted_at)
            .first::<Option<chrono::NaiveDateTime>>(conn)
            .expect("deleted_at");

        assert!(deleted_at.is_none());
    }

    #[tokio::test]
    async fn search_query_treats_percent_as_literal() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        repo.create_transaction(sample_transaction("50% off sale"))
            .await
            .expect("create percent transaction");
        repo.create_transaction(sample_transaction("Regular lunch"))
            .await
            .expect("create plain transaction");

        let filters = TransactionSearchFilters {
            query: Some("%"),
            categories: None,
            transaction_type: None,
            start_date: None,
            end_date: None,
        };

        let result = repo
            .get_transactions(1, 10, Some(filters), None)
            .expect("search transactions");

        assert_eq!(result.data.len(), 1);
        assert_eq!(result.data[0].description.as_deref(), Some("50% off sale"));
    }

    #[derive(Debug, diesel::QueryableByName)]
    #[allow(dead_code)]
    struct ExplainQueryPlanRow {
        #[diesel(sql_type = diesel::sql_types::Integer)]
        id: i32,
        #[diesel(sql_type = diesel::sql_types::Integer)]
        parent: i32,
        #[diesel(sql_type = diesel::sql_types::Integer)]
        notused: i32,
        #[diesel(sql_type = diesel::sql_types::Text)]
        detail: String,
    }

    #[tokio::test]
    async fn active_transactions_by_date_uses_partial_index() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        repo.create_transaction(sample_transaction("Indexed lunch"))
            .await
            .expect("create transaction");

        let conn = &mut get_connection(&repo.pool).expect("connection");
        let plan = diesel::sql_query(
            "EXPLAIN QUERY PLAN \
             SELECT * FROM transactions \
             WHERE deleted_at IS NULL \
             ORDER BY transaction_date DESC, created_at ASC \
             LIMIT 10",
        )
        .load::<ExplainQueryPlanRow>(conn)
        .expect("explain query plan");

        assert!(
            plan.iter()
                .any(|row| row.detail.contains("transactions_active_date_index")),
            "expected transactions_active_date_index in query plan: {plan:?}"
        );
    }

    #[tokio::test]
    async fn search_query_treats_underscore_as_literal() {
        let temp_db = TempDb::new();
        let repo = setup_test_repo(temp_db.path());

        repo.create_transaction(sample_transaction("foo_bar purchase"))
            .await
            .expect("create underscore transaction");
        repo.create_transaction(sample_transaction("foobar purchase"))
            .await
            .expect("create plain transaction");

        let filters = TransactionSearchFilters {
            query: Some("_"),
            categories: None,
            transaction_type: None,
            start_date: None,
            end_date: None,
        };

        let result = repo
            .get_transactions(1, 10, Some(filters), None)
            .expect("search transactions");

        assert_eq!(result.data.len(), 1);
        assert_eq!(
            result.data[0].description.as_deref(),
            Some("foo_bar purchase")
        );
    }
}
