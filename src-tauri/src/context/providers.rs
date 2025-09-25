use std::sync::Arc;
use zai_core::services::transaction_categories::TransactionCategoriesService;
use zai_db::repositories::transaction_categories::TransactionCategoriesRepository;
use crate::context::ServiceContext;

pub async fn initialize_context(
    app_data_dir: &str,
) -> Result<ServiceContext, Box<dyn std::error::Error>> {

    let db_path = zai_db::init(app_data_dir)?;
    let pool = zai_db::create_pool(&db_path)?;
    let writer = zai_db::write_actor::spawn_writer(pool.as_ref().clone());

    // Run migrations using the pool directly if run_migrations expects a Pool
    zai_db::run_migrations(&pool)?;

    // Repositories
    let transaction_categories_repository = Arc::new(TransactionCategoriesRepository::new(pool.clone(), writer.clone()));


    // Services
    let transaction_categories_service = Arc::new(TransactionCategoriesService::new(
        transaction_categories_repository.clone()
    ));

    Ok(ServiceContext {
        transaction_categories_service,
    })
}