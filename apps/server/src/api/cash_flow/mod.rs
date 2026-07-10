use std::sync::Arc;

use axum::Router;
use zai_app::ServiceContext;

mod categories;
mod transactions;

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new()
        .merge(categories::router())
        .nest("/transactions", transactions::router())
}
