use std::sync::Arc;

use axum::Router;
use zai_app::ServiceContext;

mod budgets;
mod categories;
mod transactions;

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new()
        .merge(categories::router())
        .merge(budgets::router())
        .nest("/transactions", transactions::router())
}
