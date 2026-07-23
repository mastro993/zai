mod adopt;
#[cfg(test)]
mod adopt_tests;
#[cfg(test)]
mod bulk_tests;
#[cfg(any(test, feature = "failpoints"))]
pub mod crash_child;
mod create;
mod edit;
#[cfg(test)]
mod edit_policy_tests;
#[cfg(test)]
mod edit_revision_tests;
#[cfg(test)]
mod edit_tests;
#[cfg(any(test, feature = "failpoints"))]
pub(crate) mod failpoints;
mod feed;
mod fulfill;
mod fulfill_head;
mod fulfill_select;
mod fulfill_validation;
mod generation_failure;
mod lifecycle;
#[cfg(test)]
mod lifecycle_edge_tests;
#[cfg(test)]
mod lifecycle_test_support;
#[cfg(test)]
mod lifecycle_tests;
mod matching;
mod models;
#[cfg(test)]
mod process_contention_tests;
#[cfg(test)]
mod process_crash_tests;
#[cfg(test)]
mod process_effect_tests;
#[cfg(test)]
mod process_heal_tests;
#[cfg(test)]
mod process_lifecycle_race_tests;
#[cfg(test)]
mod process_test_support;
#[cfg(test)]
mod process_tests;
#[cfg(test)]
mod projection_tests;
mod queries;
mod queries_projection;
mod repair;
#[cfg(test)]
mod repair_tests;
mod repository;
mod repository_projection;
#[cfg(test)]
mod repository_query_tests;
mod repository_trait;
mod revisions;
#[cfg(test)]
mod seed;

#[cfg(any(test, feature = "failpoints"))]
pub use crash_child::run_crash_child_from_env;
#[cfg(any(test, feature = "failpoints"))]
pub use failpoints::FulfillmentFailpoint;
pub use repository::RecurringTransactionsRepository;
