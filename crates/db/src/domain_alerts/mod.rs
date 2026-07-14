mod insert;
mod lifecycle;
mod list;
mod models;
mod repository;
#[cfg(test)]
mod repository_event_tests;
#[cfg(test)]
mod repository_insert_tests;
#[cfg(test)]
mod repository_lifecycle_tests;
#[cfg(test)]
mod repository_list_tests;

pub use insert::insert_domain_alert;
pub use lifecycle::{
    mark_all_domain_alerts_read, mark_domain_alert_read, mark_domain_alert_read_with_outcome,
    mark_domain_alert_unread, mark_domain_alert_unread_with_outcome,
};
pub use list::{list_domain_alerts, unread_domain_alert_count};
pub use repository::DomainAlertsRepository;
