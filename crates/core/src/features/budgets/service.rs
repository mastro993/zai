use super::models::{
    Budget, BudgetLifecycleUpdate, BudgetListFilter, BudgetUpdate, NewBudget,
    normalize_budget_name, validate_history_paging,
};
use super::traits::{BudgetsRepositoryTrait, BudgetsServiceTrait};
use crate::Result;
use crate::features::currency::{AllowCurrencySetup, CurrencySetupGate};
use std::sync::Arc;
use uuid::Uuid;

pub struct BudgetsService {
    repository: Arc<dyn BudgetsRepositoryTrait>,
    currency_setup: Arc<dyn CurrencySetupGate>,
}

impl BudgetsService {
    pub fn new(repository: Arc<dyn BudgetsRepositoryTrait>) -> Self {
        Self {
            repository,
            currency_setup: Arc::new(AllowCurrencySetup),
        }
    }

    pub fn with_currency_setup(mut self, currency_setup: Arc<dyn CurrencySetupGate>) -> Self {
        self.currency_setup = currency_setup;
        self
    }
}

#[async_trait::async_trait]
impl BudgetsServiceTrait for BudgetsService {
    async fn list_budgets(&self, filter: BudgetListFilter) -> Result<Vec<Budget>> {
        self.currency_setup.require_setup()?;
        self.repository.list_budgets(filter).await
    }

    async fn get_budget(&self, id: &str) -> Result<Budget> {
        self.currency_setup.require_setup()?;
        self.repository.get_budget(id).await
    }

    async fn get_budget_history(
        &self,
        id: &str,
        page: i64,
        per_page: i64,
    ) -> Result<super::models::BudgetPeriodHistory> {
        self.currency_setup.require_setup()?;
        validate_history_paging(page, per_page)?;
        self.repository.get_budget_history(id, page, per_page).await
    }

    async fn create_budget(&self, mut budget: NewBudget) -> Result<Budget> {
        self.currency_setup.require_setup()?;
        budget.name = normalize_budget_name(&budget.name);
        budget.validate()?;
        budget.measurement_mode.get_or_insert_default();
        budget.rollover_mode.get_or_insert_default();
        budget.warning_percentage.get_or_insert(80);

        budget.id = Some(Uuid::new_v4().to_string());
        self.repository.create_budget(budget).await
    }

    async fn update_budget(&self, id: &str, mut budget: BudgetUpdate) -> Result<Budget> {
        self.currency_setup.require_setup()?;
        budget.name = normalize_budget_name(&budget.name);
        budget.validate()?;
        self.repository.update_budget(id, budget).await
    }

    async fn pause_budget(&self, id: &str, update: BudgetLifecycleUpdate) -> Result<Budget> {
        self.currency_setup.require_setup()?;
        update.validate()?;
        self.repository.pause_budget(id, update).await
    }

    async fn resume_budget(&self, id: &str, update: BudgetLifecycleUpdate) -> Result<Budget> {
        self.currency_setup.require_setup()?;
        update.validate()?;
        self.repository.resume_budget(id, update).await
    }

    async fn delete_budget(&self, id: &str, update: BudgetLifecycleUpdate) -> Result<()> {
        self.currency_setup.require_setup()?;
        update.validate()?;
        self.repository.delete_budget(id, update).await
    }
}
