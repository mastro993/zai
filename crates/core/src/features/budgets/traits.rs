use super::models::{Budget, NewBudget};
use crate::Result;
use async_trait::async_trait;

#[async_trait]
pub trait BudgetsRepositoryTrait: Send + Sync {
    async fn list_budgets(&self) -> Result<Vec<Budget>>;
    async fn get_budget(&self, id: &str) -> Result<Budget>;
    async fn create_budget(&self, budget: NewBudget) -> Result<Budget>;
}

#[async_trait]
pub trait BudgetsServiceTrait: Send + Sync {
    async fn list_budgets(&self) -> Result<Vec<Budget>>;
    async fn get_budget(&self, id: &str) -> Result<Budget>;
    async fn create_budget(&self, budget: NewBudget) -> Result<Budget>;
}
