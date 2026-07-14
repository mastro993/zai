mod cursor;
mod models;
#[cfg(test)]
mod models_tests;
mod outcome;
#[cfg(test)]
mod outcome_tests;
mod query;
#[cfg(test)]
mod query_tests;
mod service;
mod traits;

pub use cursor::{DomainAlertCursor, decode_cursor, encode_cursor};
pub use models::{
    DomainAlert, DomainAlertDestination, DomainAlertRichData, DomainAlertSeverity, NewDomainAlert,
};
pub use outcome::{AlertInsertOutcome, CommittedOutcome};
pub use query::{
    DEFAULT_LIST_LIMIT, DomainAlertListPage, DomainAlertReadState, ListDomainAlertsQuery,
    MAX_LIST_LIMIT, MIN_LIST_LIMIT, deserialize_optional_severities,
};
pub use service::DomainAlertsService;
pub use traits::{DomainAlertsRepositoryTrait, DomainAlertsServiceTrait};
