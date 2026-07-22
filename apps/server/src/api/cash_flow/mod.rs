use std::sync::Arc;

use axum::Router;
use zai_app::ServiceContext;

mod budgets;
mod categories;
mod recurring_bulk;
mod recurring_processing_events;
mod recurring_transactions;
mod transactions;

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new()
        .merge(categories::router())
        .merge(budgets::router())
        .merge(recurring_transactions::router())
        .merge(recurring_bulk::router())
        .merge(recurring_processing_events::router())
        .nest("/transactions", transactions::router())
}
