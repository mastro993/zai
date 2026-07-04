use crate::context::ServiceContext;
use std::sync::Arc;
use zai_core::features::transaction_categories::service::TransactionCategoriesService;
use zai_core::features::transactions::service::TransactionsService;

pub fn initialize_context(
    app_data_dir: impl AsRef<std::path::Path>,
) -> Result<ServiceContext, Box<dyn std::error::Error>> {
    let database = zai_db::connect(app_data_dir)?;
    log::info!("Database initialized at {}", database.path().display());

    let transaction_categories_repository = database.transaction_categories_repository();
    let transactions_repository = database.transactions_repository();

    let transaction_categories_service = Arc::new(TransactionCategoriesService::new(
        transaction_categories_repository,
    ));
    let transactions_service = Arc::new(TransactionsService::new(transactions_repository));

    Ok(ServiceContext {
        transaction_categories_service,
        transactions_service,
    })
}
