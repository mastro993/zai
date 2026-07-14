mod models;
#[cfg(test)]
mod models_tests;
mod outcome;
#[cfg(test)]
mod outcome_tests;

pub use models::{
    DomainAlert, DomainAlertDestination, DomainAlertRichData, DomainAlertSeverity, NewDomainAlert,
};
pub use outcome::{AlertInsertOutcome, CommittedOutcome};
