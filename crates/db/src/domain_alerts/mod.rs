mod insert;
mod models;
mod repository;
#[cfg(test)]
mod repository_insert_tests;

pub use insert::insert_domain_alert;
pub use repository::DomainAlertsRepository;
