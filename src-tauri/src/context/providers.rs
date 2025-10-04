use crate::context::ServiceContext;
use std::sync::Arc;
use zai_core::features::transaction_categories::transaction_categories_repository::TransactionCategoriesRepository;
use zai_core::features::transaction_categories::transaction_categories_service::TransactionCategoriesService;
use zai_core::features::transactions::transactions_repository::TransactionsRepository;
use zai_core::features::transactions::transactions_service::TransactionsService;

pub async fn initialize_context(
    app_data_dir: &str,
) -> Result<ServiceContext, Box<dyn std::error::Error>> {
    let db_path = zai_core::database::init(app_data_dir)?;
    let pool = zai_core::database::create_pool(&db_path)?;
    let writer = zai_core::database::write_actor::spawn_writer(pool.as_ref().clone());
    log::info!("Database initialized at {}", db_path);

    // Run migrations using the pool directly if run_migrations expects a Pool
    zai_core::database::run_migrations(&pool)?;

    // Repositories
    let transaction_categories_repository = Arc::new(TransactionCategoriesRepository::new(
        pool.clone(),
        writer.clone(),
    ));
    let transactions_repository =
        Arc::new(TransactionsRepository::new(pool.clone(), writer.clone()));

    // Services
    let transaction_categories_service = Arc::new(TransactionCategoriesService::new(
        transaction_categories_repository.clone(),
    ));
    let transactions_service = Arc::new(TransactionsService::new(transactions_repository.clone()));

    Ok(ServiceContext {
        transaction_categories_service,
        transactions_service,
    })
}
