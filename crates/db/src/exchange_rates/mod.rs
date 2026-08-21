mod repository;

#[cfg(test)]
mod repository_tests;

pub use repository::ExchangeRateRepository;
pub(crate) use repository::{coverage_proof_digest, current_accepted_set, quote_legs};
