use std::{path::Path, sync::Arc};

use zai_core::features::{
    budgets::{service::BudgetsService, traits::BudgetsServiceTrait},
    transaction_categories::{
        service::TransactionCategoriesService, traits::TransactionCategoriesServiceTrait,
    },
    transactions::{service::TransactionsService, traits::TransactionsServiceTrait},
};

pub struct ServiceContext {
    pub budgets_service: Arc<dyn BudgetsServiceTrait>,
    pub transaction_categories_service: Arc<dyn TransactionCategoriesServiceTrait>,
    pub transactions_service: Arc<dyn TransactionsServiceTrait>,
}

impl ServiceContext {
    pub fn budgets_service(&self) -> Arc<dyn BudgetsServiceTrait> {
        Arc::clone(&self.budgets_service)
    }

    pub fn transaction_categories_service(&self) -> Arc<dyn TransactionCategoriesServiceTrait> {
        Arc::clone(&self.transaction_categories_service)
    }

    pub fn transactions_service(&self) -> Arc<dyn TransactionsServiceTrait> {
        Arc::clone(&self.transactions_service)
    }
}

pub fn initialize_context(app_data_dir: impl AsRef<Path>) -> zai_core::Result<ServiceContext> {
    let database = zai_db::connect(app_data_dir)?;
    log::info!("Database initialized at {}", database.path().display());

    let transaction_categories_repository = database.transaction_categories_repository();
    let transactions_repository = database.transactions_repository();
    let budgets_repository = database.budgets_repository();

    Ok(ServiceContext {
        budgets_service: Arc::new(BudgetsService::new(budgets_repository)),
        transaction_categories_service: Arc::new(TransactionCategoriesService::new(
            transaction_categories_repository,
        )),
        transactions_service: Arc::new(TransactionsService::new(transactions_repository)),
    })
}

#[cfg(test)]
mod tests {
    use std::{
        env, fs,
        path::{Path, PathBuf},
    };

    use uuid::Uuid;

    use super::initialize_context;

    struct TempAppDataDir {
        path: PathBuf,
    }

    impl TempAppDataDir {
        fn new() -> Self {
            Self {
                path: env::temp_dir().join(format!("zai-app-context-{}", Uuid::new_v4())),
            }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TempAppDataDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[tokio::test]
    async fn shared_context_initializes_cash_flow_services_from_app_data_dir() {
        let app_data_dir = TempAppDataDir::new();

        let context = initialize_context(app_data_dir.path()).expect("context should initialize");

        assert!(app_data_dir.path().join("zai.db").exists());

        let categories = context
            .transaction_categories_service()
            .get_categories(None)
            .expect("categories service should query migrated database");
        let transactions = context
            .transactions_service()
            .get_transactions(1, 20, None, None)
            .expect("transactions service should query migrated database");
        let budgets = context
            .budgets_service()
            .list_budgets()
            .await
            .expect("budgets service should query migrated database");

        assert!(categories.is_empty());
        assert!(transactions.data.is_empty());
        assert!(budgets.is_empty());
    }
}
