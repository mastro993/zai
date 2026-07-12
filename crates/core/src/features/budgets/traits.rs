use super::models::{Budget, BudgetPeriodHistory, NewBudget};
use crate::Result;
use async_trait::async_trait;

#[async_trait]
pub trait BudgetsRepositoryTrait: Send + Sync {
    async fn list_budgets(&self) -> Result<Vec<Budget>>;
    async fn get_budget(&self, id: &str) -> Result<Budget>;
    async fn get_budget_history(
        &self,
        id: &str,
        page: i64,
        per_page: i64,
    ) -> Result<BudgetPeriodHistory>;
    async fn create_budget(&self, budget: NewBudget) -> Result<Budget>;
}

#[async_trait]
pub trait BudgetsServiceTrait: Send + Sync {
    async fn list_budgets(&self) -> Result<Vec<Budget>>;
    async fn get_budget(&self, id: &str) -> Result<Budget>;
    async fn get_budget_history(
        &self,
        id: &str,
        page: i64,
        per_page: i64,
    ) -> Result<BudgetPeriodHistory>;
    async fn create_budget(&self, budget: NewBudget) -> Result<Budget>;
}

pub trait CalendarClock: Send + Sync {
    fn sample(&self) -> chrono::NaiveDateTime;
}

#[derive(Debug, Default)]
pub struct LocalCalendarClock;

impl CalendarClock for LocalCalendarClock {
    fn sample(&self) -> chrono::NaiveDateTime {
        chrono::Local::now().naive_local()
    }
}
