use super::models::{
    Budget, BudgetLifecycleUpdate, BudgetListFilter, BudgetUpdate, NewBudget,
    normalize_budget_name, validate_history_paging,
};
use super::traits::{BudgetsRepositoryTrait, BudgetsServiceTrait};
use crate::Result;
use std::sync::Arc;
use uuid::Uuid;

pub struct BudgetsService {
    repository: Arc<dyn BudgetsRepositoryTrait>,
}

impl BudgetsService {
    pub fn new(repository: Arc<dyn BudgetsRepositoryTrait>) -> Self {
        Self { repository }
    }
}

#[async_trait::async_trait]
impl BudgetsServiceTrait for BudgetsService {
    async fn list_budgets(&self, filter: BudgetListFilter) -> Result<Vec<Budget>> {
        self.repository.list_budgets(filter).await
    }

    async fn get_budget(&self, id: &str) -> Result<Budget> {
        self.repository.get_budget(id).await
    }

    async fn get_budget_history(
        &self,
        id: &str,
        page: i64,
        per_page: i64,
    ) -> Result<super::models::BudgetPeriodHistory> {
        validate_history_paging(page, per_page)?;
        self.repository.get_budget_history(id, page, per_page).await
    }

    async fn create_budget(&self, mut budget: NewBudget) -> Result<Budget> {
        budget.name = normalize_budget_name(&budget.name);
        budget.validate()?;
        budget.measurement_mode.get_or_insert_default();
        budget.rollover_mode.get_or_insert_default();
        budget.warning_percentage.get_or_insert(80);

        budget.id = Some(Uuid::new_v4().to_string());
        self.repository.create_budget(budget).await
    }

    async fn update_budget(&self, id: &str, mut budget: BudgetUpdate) -> Result<Budget> {
        budget.name = normalize_budget_name(&budget.name);
        budget.validate()?;
        self.repository.update_budget(id, budget).await
    }

    async fn pause_budget(&self, id: &str, update: BudgetLifecycleUpdate) -> Result<Budget> {
        update.validate()?;
        self.repository.pause_budget(id, update).await
    }

    async fn resume_budget(&self, id: &str, update: BudgetLifecycleUpdate) -> Result<Budget> {
        update.validate()?;
        self.repository.resume_budget(id, update).await
    }
}
