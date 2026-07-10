use crate::errors::{Error, Result};
use crate::features::budgets::models::{
    Budget, BudgetListStatus, BudgetPeriod, BudgetScope, BudgetScopeTarget, BudgetStatus,
    NewBudget, StoredBudget, StoredBudgetRevision,
};
use crate::features::budgets::periods::{period_start_for_date, periods_up_to};
use crate::features::budgets::traits::{
    BudgetsRepositoryTrait, BudgetsServiceTrait, LocalDateClock, SystemLocalDateClock,
};
use crate::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;
use crate::features::transactions::models::Transaction;
use crate::features::transactions::traits::TransactionsRepositoryTrait;
use chrono::{NaiveDate, NaiveTime};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

pub struct BudgetsService {
    repository: Arc<dyn BudgetsRepositoryTrait>,
    categories_repository: Arc<dyn TransactionCategoriesRepositoryTrait>,
    transactions_repository: Arc<dyn TransactionsRepositoryTrait>,
    clock: Arc<dyn LocalDateClock>,
}

impl BudgetsService {
    pub fn new(
        repository: Arc<dyn BudgetsRepositoryTrait>,
        categories_repository: Arc<dyn TransactionCategoriesRepositoryTrait>,
        transactions_repository: Arc<dyn TransactionsRepositoryTrait>,
    ) -> Self {
        Self {
            repository,
            categories_repository,
            transactions_repository,
            clock: Arc::new(SystemLocalDateClock),
        }
    }

    #[cfg(test)]
    pub fn with_clock(
        repository: Arc<dyn BudgetsRepositoryTrait>,
        categories_repository: Arc<dyn TransactionCategoriesRepositoryTrait>,
        transactions_repository: Arc<dyn TransactionsRepositoryTrait>,
        clock: Arc<dyn LocalDateClock>,
    ) -> Self {
        Self {
            repository,
            categories_repository,
            transactions_repository,
            clock,
        }
    }
}

#[async_trait::async_trait]
impl BudgetsServiceTrait for BudgetsService {
    fn get_budgets(&self, status: BudgetListStatus) -> Result<Vec<Budget>> {
        let stored_budgets = self.repository.get_budgets(status)?;
        stored_budgets
            .into_iter()
            .map(|stored| self.build_budget_read_model(stored))
            .collect()
    }

    fn get_budget(&self, id: &str) -> Result<Budget> {
        let stored = self.repository.get_budget(id)?;
        self.build_budget_read_model(stored)
    }

    async fn create_budget(&self, new_budget: NewBudget) -> Result<Budget> {
        new_budget.validate()?;

        let categories = self.categories_repository.get_categories(None)?;

        validate_category_targets(&new_budget.category_ids, &categories)?;
        let canonical_scope = canonicalize_category_ids(&new_budget.category_ids);

        let duplicates = self.repository.find_active_budgets_with_scope_and_cadence(
            new_budget.cadence.as_str(),
            &canonical_scope,
        )?;
        if !duplicates.is_empty() {
            return Err(Error::InvalidData(
                "An active budget with the same cadence and category scope already exists"
                    .to_string(),
            ));
        }

        let today = self.clock.today();
        let first_period_start = period_start_for_date(today, new_budget.cadence)?;
        let budget_id = Uuid::new_v4().to_string();
        let revision_id = Uuid::new_v4().to_string();

        let stored = StoredBudget {
            id: budget_id.clone(),
            name: new_budget.name.trim().to_string(),
            cadence: new_budget.cadence,
            first_period_start,
            deactivated_at: None,
            revisions: vec![StoredBudgetRevision {
                id: revision_id.clone(),
                budget_id: budget_id.clone(),
                effective_period_start: first_period_start,
                allowance: new_budget.allowance,
                category_ids: canonical_scope,
            }],
        };

        let revision = stored.revisions[0].clone();
        let created = self.repository.create_budget(stored, revision).await?;
        self.build_budget_read_model(created)
    }
}

impl BudgetsService {
    fn build_budget_read_model(&self, stored: StoredBudget) -> Result<Budget> {
        let categories = self.categories_repository.get_categories(None)?;
        let scope = build_scope(&stored.revisions[0].category_ids, &categories)?;
        let current_period = self.calculate_current_period(&stored, &scope.effective_category_ids)?;

        Ok(Budget {
            id: stored.id,
            name: stored.name,
            cadence: stored.cadence,
            status: if stored.deactivated_at.is_some() {
                BudgetStatus::Deactivated
            } else {
                BudgetStatus::Active
            },
            first_period_start: stored.first_period_start,
            scope,
            current_period: Some(current_period),
        })
    }

    fn calculate_current_period(
        &self,
        stored: &StoredBudget,
        effective_category_ids: &[String],
    ) -> Result<BudgetPeriod> {
        let today = self.clock.today();
        let periods = periods_up_to(stored.first_period_start, stored.cadence, today)?;
        let effective_ids = effective_category_ids
            .iter()
            .cloned()
            .collect::<HashSet<_>>();

        let mut carried_balance = 0i32;
        let mut current_period = None;

        for (period_start, period_end) in periods {
            let revision = revision_for_period(&stored.revisions, period_start)?;
            let activity = self.activity_for_period(period_start, period_end, &effective_ids)?;
            let period_carried = carried_balance;
            let available = revision.allowance + period_carried - activity;
            carried_balance = available;

            current_period = Some(BudgetPeriod {
                start_date: period_start,
                end_date: period_end,
                allowance: revision.allowance,
                carried_balance: period_carried,
                activity,
                available,
            });
        }

        current_period.ok_or_else(|| Error::InvalidData("Failed to compute budget period".into()))
    }

    fn activity_for_period(
        &self,
        start: NaiveDate,
        end: NaiveDate,
        effective_category_ids: &HashSet<String>,
    ) -> Result<i32> {
        let start_datetime = start.and_time(NaiveTime::from_hms_opt(0, 0, 0).unwrap());
        let end_datetime = end.and_time(NaiveTime::from_hms_opt(23, 59, 59).unwrap());
        let transactions = self
            .transactions_repository
            .find_transactions_in_date_range(start_datetime, end_datetime)?;

        let mut expenses = 0i32;
        let mut income = 0i32;

        for transaction in transactions {
            if !transaction_matches_scope(&transaction, effective_category_ids) {
                continue;
            }

            match transaction.transaction_type.as_str() {
                "expense" => expenses += transaction.amount,
                "income" => income += transaction.amount,
                _ => {}
            }
        }

        Ok(expenses - income)
    }
}

fn transaction_matches_scope(
    transaction: &Transaction,
    effective_category_ids: &HashSet<String>,
) -> bool {
    transaction
        .transaction_category_id
        .as_ref()
        .is_some_and(|category_id| effective_category_ids.contains(category_id))
}

fn revision_for_period(
    revisions: &[StoredBudgetRevision],
    period_start: NaiveDate,
) -> Result<&StoredBudgetRevision> {
    revisions
        .iter()
        .filter(|revision| revision.effective_period_start <= period_start)
        .max_by_key(|revision| revision.effective_period_start)
        .ok_or_else(|| Error::InvalidData("Missing budget revision for period".into()))
}

pub fn canonicalize_category_ids(category_ids: &[String]) -> Vec<String> {
    let mut ids = category_ids.to_vec();
    ids.sort();
    ids.dedup();
    ids
}

fn validate_category_targets(
    category_ids: &[String],
    categories: &[crate::features::transaction_categories::models::TransactionCategory],
) -> Result<()> {
    let category_by_id = categories
        .iter()
        .map(|category| (category.id.as_str(), category))
        .collect::<HashMap<_, _>>();

    for category_id in category_ids {
        category_by_id.get(category_id.as_str()).ok_or_else(|| {
            Error::InvalidData(format!("Unknown category in budget scope: {category_id}"))
        })?;
    }

    Ok(())
}

pub fn build_scope(
    target_category_ids: &[String],
    categories: &[crate::features::transaction_categories::models::TransactionCategory],
) -> Result<BudgetScope> {
    let category_by_id = categories
        .iter()
        .map(|category| (category.id.clone(), category))
        .collect::<HashMap<_, _>>();

    let mut targets = Vec::with_capacity(target_category_ids.len());
    let mut effective_category_ids = HashSet::new();

    for category_id in target_category_ids {
        let category = category_by_id.get(category_id).ok_or_else(|| {
            Error::InvalidData(format!("Unknown category in budget scope: {category_id}"))
        })?;
        let is_root = category.parent_id.is_none();
        targets.push(BudgetScopeTarget {
            category_id: category.id.clone(),
            category_name: category.name.clone(),
            is_root,
        });

        if is_root {
            effective_category_ids.insert(category.id.clone());
            for child in categories.iter().filter(|item| item.parent_id.as_deref() == Some(&category.id)) {
                effective_category_ids.insert(child.id.clone());
            }
        } else {
            effective_category_ids.insert(category.id.clone());
        }
    }

    let mut effective_ids = effective_category_ids.into_iter().collect::<Vec<_>>();
    effective_ids.sort();

    Ok(BudgetScope {
        targets,
        effective_category_ids: effective_ids,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::budgets::models::BudgetCadence;
    use crate::features::transaction_categories::models::TransactionCategory;
    use crate::features::transactions::traits::TransactionsRepositoryTrait;
    use chrono::NaiveDateTime;
    use std::sync::Mutex;

    struct FixedClock(NaiveDate);

    impl LocalDateClock for FixedClock {
        fn today(&self) -> NaiveDate {
            self.0
        }
    }

    #[derive(Default)]
    struct FakeBudgetsRepository {
        budgets: Mutex<Vec<StoredBudget>>,
    }

    #[async_trait::async_trait]
    impl BudgetsRepositoryTrait for FakeBudgetsRepository {
        fn get_budgets(&self, _status: BudgetListStatus) -> Result<Vec<StoredBudget>> {
            Ok(self.budgets.lock().unwrap().clone())
        }

        fn get_budget(&self, id: &str) -> Result<StoredBudget> {
            self.budgets
                .lock()
                .unwrap()
                .iter()
                .find(|budget| budget.id == id)
                .cloned()
                .ok_or_else(|| Error::NotFound(format!("Budget {id} not found")))
        }

        fn find_active_budgets_with_scope_and_cadence(
            &self,
            cadence: &str,
            canonical_category_ids: &[String],
        ) -> Result<Vec<StoredBudget>> {
            let budgets = self.budgets.lock().unwrap();
            Ok(budgets
                .iter()
                .filter(|budget| {
                    budget.deactivated_at.is_none()
                        && budget.cadence.as_str() == cadence
                        && budget.revisions[0].category_ids == canonical_category_ids
                })
                .cloned()
                .collect())
        }

        async fn create_budget(
            &self,
            budget: StoredBudget,
            _revision: StoredBudgetRevision,
        ) -> Result<StoredBudget> {
            self.budgets.lock().unwrap().push(budget.clone());
            Ok(budget)
        }
    }

    struct FakeCategoriesRepository {
        categories: Vec<TransactionCategory>,
    }

    #[async_trait::async_trait]
    impl TransactionCategoriesRepositoryTrait for FakeCategoriesRepository {
        fn get_categories(
            &self,
            parent_id: Option<&str>,
        ) -> Result<Vec<TransactionCategory>> {
            Ok(self
                .categories
                .iter()
                .filter(|category| match parent_id {
                    Some(parent) => category.parent_id.as_deref() == Some(parent),
                    None => true,
                })
                .cloned()
                .collect())
        }

        fn get_category(&self, _id: &str) -> Result<TransactionCategory> {
            Err(Error::InvalidData("unused".into()))
        }

        fn category_has_children(&self, _id: &str) -> Result<bool> {
            Err(Error::InvalidData("unused".into()))
        }

        fn sibling_name_exists(
            &self,
            _parent_id: Option<&str>,
            _name: &str,
            _excluded_id: Option<&str>,
        ) -> Result<bool> {
            Err(Error::InvalidData("unused".into()))
        }

        async fn create_category(
            &self,
            _new_category: crate::features::transaction_categories::models::NewTransactionCategory,
        ) -> Result<TransactionCategory> {
            Err(Error::InvalidData("unused".into()))
        }

        async fn update_category(
            &self,
            _updated_category: crate::features::transaction_categories::models::TransactionCategoryUpdate,
        ) -> Result<TransactionCategory> {
            Err(Error::InvalidData("unused".into()))
        }

        async fn delete_categories(
            &self,
            _ids: Vec<&str>,
            _children_strategy: crate::features::transaction_categories::models::CategoryChildrenDeleteStrategy,
        ) -> Result<Vec<TransactionCategory>> {
            Err(Error::InvalidData("unused".into()))
        }

        async fn import_categories(
            &self,
            _categories: Vec<crate::features::transaction_categories::models::NewTransactionCategory>,
        ) -> Result<Vec<TransactionCategory>> {
            Err(Error::InvalidData("unused".into()))
        }
    }

    #[derive(Default)]
    struct FakeTransactionsRepository {
        transactions: Mutex<Vec<Transaction>>,
    }

    #[async_trait::async_trait]
    impl TransactionsRepositoryTrait for FakeTransactionsRepository {
        fn get_transactions(
            &self,
            _page: i64,
            _per_page: i64,
            _filters: Option<crate::features::transactions::models::TransactionSearchFilters>,
            _sort: Option<crate::query::Sort>,
        ) -> Result<crate::query::PaginatedData<Transaction>> {
            Err(Error::InvalidData("unused".into()))
        }

        fn get_transaction(&self, _id: &str) -> Result<Transaction> {
            Err(Error::InvalidData("unused".into()))
        }

        async fn create_transaction(
            &self,
            _new_transaction: crate::features::transactions::models::NewTransaction,
        ) -> Result<Transaction> {
            Err(Error::InvalidData("unused".into()))
        }

        async fn update_transaction(
            &self,
            _updated_transaction: crate::features::transactions::models::TransactionUpdate,
        ) -> Result<Transaction> {
            Err(Error::InvalidData("unused".into()))
        }

        async fn delete_transaction(&self, _id: &str) -> Result<Transaction> {
            Err(Error::InvalidData("unused".into()))
        }

        async fn delete_transactions(&self, _ids: Vec<&str>) -> Result<Vec<Transaction>> {
            Err(Error::InvalidData("unused".into()))
        }

        fn find_transactions_in_date_range(
            &self,
            _start_date: NaiveDateTime,
            _end_date: NaiveDateTime,
        ) -> Result<Vec<Transaction>> {
            Ok(self.transactions.lock().unwrap().clone())
        }

        async fn import_transactions(
            &self,
            _transactions: Vec<crate::features::transactions::models::NewTransaction>,
        ) -> Result<Vec<Transaction>> {
            Err(Error::InvalidData("unused".into()))
        }

        async fn import_transactions_with_categories(
            &self,
            _categories: Vec<crate::features::transaction_categories::models::NewTransactionCategory>,
            _transactions: Vec<crate::features::transactions::models::NewTransaction>,
        ) -> Result<(Vec<TransactionCategory>, Vec<Transaction>)> {
            Err(Error::InvalidData("unused".into()))
        }
    }

    fn sample_categories() -> Vec<TransactionCategory> {
        vec![
            TransactionCategory {
                id: "root-food".to_string(),
                parent_id: None,
                name: "Food".to_string(),
                description: None,
                color: Some("#951818".to_string()),
                parent: None,
            },
            TransactionCategory {
                id: "child-groceries".to_string(),
                parent_id: Some("root-food".to_string()),
                name: "Groceries".to_string(),
                description: None,
                color: None,
                parent: None,
            },
            TransactionCategory {
                id: "child-dining".to_string(),
                parent_id: Some("root-food".to_string()),
                name: "Dining".to_string(),
                description: None,
                color: None,
                parent: None,
            },
        ]
    }

    fn service_with(
        budgets: Arc<FakeBudgetsRepository>,
        categories: Vec<TransactionCategory>,
        transactions: Vec<Transaction>,
        today: NaiveDate,
    ) -> BudgetsService {
        BudgetsService::with_clock(
            budgets,
            Arc::new(FakeCategoriesRepository { categories }),
            Arc::new(FakeTransactionsRepository {
                transactions: Mutex::new(transactions),
            }),
            Arc::new(FixedClock(today)),
        )
    }

    #[tokio::test]
    async fn create_budget_starts_in_current_period() {
        let service = service_with(
            Arc::new(FakeBudgetsRepository::default()),
            sample_categories(),
            vec![],
            NaiveDate::from_ymd_opt(2026, 7, 10).unwrap(),
        );

        let budget = service
            .create_budget(NewBudget {
                name: "Food budget".to_string(),
                allowance: 50_000,
                cadence: BudgetCadence::Monthly,
                category_ids: vec!["root-food".to_string()],
            })
            .await
            .expect("create budget");

        assert_eq!(budget.status, BudgetStatus::Active);
        assert_eq!(budget.first_period_start, NaiveDate::from_ymd_opt(2026, 7, 1).unwrap());
        assert_eq!(budget.current_period.as_ref().unwrap().allowance, 50_000);
    }

    #[tokio::test]
    async fn root_scope_includes_child_activity() {
        let transactions = vec![Transaction {
            id: "txn-1".to_string(),
            description: Some("Lunch".to_string()),
            amount: 2_500,
            transaction_date: NaiveDateTime::parse_from_str("2026-07-09T12:00:00", "%Y-%m-%dT%H:%M:%S")
                .unwrap(),
            transaction_type: "expense".to_string(),
            transaction_category_id: Some("child-groceries".to_string()),
            notes: None,
        }];

        let service = service_with(
            Arc::new(FakeBudgetsRepository::default()),
            sample_categories(),
            transactions,
            NaiveDate::from_ymd_opt(2026, 7, 10).unwrap(),
        );

        let budget = service
            .create_budget(NewBudget {
                name: "Food".to_string(),
                allowance: 10_000,
                cadence: BudgetCadence::Monthly,
                category_ids: vec!["root-food".to_string()],
            })
            .await
            .expect("create budget");

        let period = budget.current_period.expect("current period");
        assert_eq!(period.activity, 2_500);
        assert_eq!(period.available, 7_500);
        assert!(budget.scope.targets[0].is_root);
        assert!(budget
            .scope
            .effective_category_ids
            .contains(&"child-groceries".to_string()));
    }

    #[tokio::test]
    async fn child_scope_stays_exact() {
        let transactions = vec![
            Transaction {
                id: "txn-1".to_string(),
                description: Some("Lunch".to_string()),
                amount: 2_500,
                transaction_date: NaiveDateTime::parse_from_str(
                    "2026-07-09T12:00:00",
                    "%Y-%m-%dT%H:%M:%S",
                )
                .unwrap(),
                transaction_type: "expense".to_string(),
                transaction_category_id: Some("child-groceries".to_string()),
                notes: None,
            },
            Transaction {
                id: "txn-2".to_string(),
                description: Some("Dinner".to_string()),
                amount: 4_000,
                transaction_date: NaiveDateTime::parse_from_str(
                    "2026-07-09T19:00:00",
                    "%Y-%m-%dT%H:%M:%S",
                )
                .unwrap(),
                transaction_type: "expense".to_string(),
                transaction_category_id: Some("child-dining".to_string()),
                notes: None,
            },
        ];

        let service = service_with(
            Arc::new(FakeBudgetsRepository::default()),
            sample_categories(),
            transactions,
            NaiveDate::from_ymd_opt(2026, 7, 10).unwrap(),
        );

        let budget = service
            .create_budget(NewBudget {
                name: "Groceries".to_string(),
                allowance: 10_000,
                cadence: BudgetCadence::Monthly,
                category_ids: vec!["child-groceries".to_string()],
            })
            .await
            .expect("create budget");

        let period = budget.current_period.expect("current period");
        assert!(!budget.scope.targets[0].is_root);
        assert_eq!(period.activity, 2_500);
    }

    #[tokio::test]
    async fn duplicate_active_scope_and_cadence_is_rejected() {
        let existing = StoredBudget {
            id: "budget-1".to_string(),
            name: "Food".to_string(),
            cadence: BudgetCadence::Monthly,
            first_period_start: NaiveDate::from_ymd_opt(2026, 7, 1).unwrap(),
            deactivated_at: None,
            revisions: vec![StoredBudgetRevision {
                id: "rev-1".to_string(),
                budget_id: "budget-1".to_string(),
                effective_period_start: NaiveDate::from_ymd_opt(2026, 7, 1).unwrap(),
                allowance: 10_000,
                category_ids: vec!["root-food".to_string()],
            }],
        };

        let repository = Arc::new(FakeBudgetsRepository::default());
        repository.budgets.lock().unwrap().push(existing);

        let service = service_with(
            repository,
            sample_categories(),
            vec![],
            NaiveDate::from_ymd_opt(2026, 7, 10).unwrap(),
        );

        let result = service
            .create_budget(NewBudget {
                name: "Another food budget".to_string(),
                allowance: 5_000,
                cadence: BudgetCadence::Monthly,
                category_ids: vec!["root-food".to_string()],
            })
            .await;

        assert!(result.is_err());
    }
}
