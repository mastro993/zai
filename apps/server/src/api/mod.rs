use std::sync::Arc;

use axum::Router;
use zai_app::ServiceContext;

mod alerts;
mod budgets;
mod categories;
mod currency;
mod diagnostics;
pub mod error;
mod live_events;
mod recurring_bulk;
mod recurring_processing_events;
mod recurring_projection;
mod recurring_transactions;
mod transactions;

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new()
        .merge(alerts::router())
        .merge(categories::router())
        .merge(currency::router())
        .merge(diagnostics::router())
        .merge(live_events::router())
        .merge(budgets::router())
        .merge(recurring_projection::projection_routes())
        .merge(recurring_transactions::router())
        .merge(recurring_bulk::router())
        .merge(recurring_processing_events::router())
        .nest("/transactions", transactions::router())
}
