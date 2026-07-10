use crate::errors::Result;
use crate::features::budgets::models::{
    Budget, BudgetListStatus, NewBudget, StoredBudget, StoredBudgetRevision,
};
use async_trait::async_trait;
use chrono::NaiveDate;

pub trait LocalDateClock: Send + Sync {
    fn today(&self) -> NaiveDate;
}

pub struct SystemLocalDateClock;

impl LocalDateClock for SystemLocalDateClock {
    fn today(&self) -> NaiveDate {
        chrono::Local::now().date_naive()
    }
}

#[async_trait]
pub trait BudgetsRepositoryTrait: Send + Sync {
    fn get_budgets(&self, status: BudgetListStatus) -> Result<Vec<StoredBudget>>;
    fn get_budget(&self, id: &str) -> Result<StoredBudget>;
    fn find_active_budgets_with_scope_and_cadence(
        &self,
        cadence: &str,
        canonical_category_ids: &[String],
    ) -> Result<Vec<StoredBudget>>;
    async fn create_budget(
        &self,
        budget: StoredBudget,
        revision: StoredBudgetRevision,
    ) -> Result<StoredBudget>;
}

#[async_trait]
pub trait BudgetsServiceTrait: Send + Sync {
    fn get_budgets(&self, status: BudgetListStatus) -> Result<Vec<Budget>>;
    fn get_budget(&self, id: &str) -> Result<Budget>;
    async fn create_budget(&self, new_budget: NewBudget) -> Result<Budget>;
}
