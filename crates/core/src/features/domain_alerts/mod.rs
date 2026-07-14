mod cursor;
mod models;
#[cfg(test)]
mod models_tests;
mod outcome;
#[cfg(test)]
mod outcome_tests;
mod query;
mod service;
mod traits;

pub use cursor::{decode_cursor, encode_cursor, DomainAlertCursor};
pub use models::{
    DomainAlert, DomainAlertDestination, DomainAlertRichData, DomainAlertSeverity, NewDomainAlert,
};
pub use outcome::{AlertInsertOutcome, CommittedOutcome};
pub use query::{
    DomainAlertListPage, DomainAlertReadState, ListDomainAlertsQuery, DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT, MIN_LIST_LIMIT,
};
pub use service::DomainAlertsService;
pub use traits::{DomainAlertsRepositoryTrait, DomainAlertsServiceTrait};
