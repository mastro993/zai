use super::contention::{ContentionRetryDecision, next_contention_retry};
use super::process::{
    ProcessOneOutcome, ProcessingSliceOutcome, ProcessingStopReason, ProcessingWorkBudget,
};
use super::process_failpoints;
use super::traits::RecurringTransactionsRepositoryTrait;
use crate::{Error, Result};
use chrono::NaiveDateTime;
use std::sync::atomic::AtomicBool;
use std::time::Instant;

pub async fn run_processing_slice(
    repository: &dyn RecurringTransactionsRepositoryTrait,
    observed_local: NaiveDateTime,
    work_budget: ProcessingWorkBudget,
    cancelled: Option<&AtomicBool>,
) -> Result<ProcessingSliceOutcome> {
    let max_occurrences = work_budget.max_occurrences.max(1);
    let mut committed = 0_u32;
    let mut already_fulfilled = 0_u32;
    let slice_started = Instant::now();
    let mut contention_started: Option<Instant> = None;
    let mut contention_attempt = 0_u32;

    loop {
        if cancelled.is_some_and(|flag| flag.load(std::sync::atomic::Ordering::SeqCst)) {
            let more_due_remaining = more_due_remaining(repository, observed_local)
                .await
                .unwrap_or(true);
            return Ok(ProcessingSliceOutcome {
                committed,
                already_fulfilled,
                more_due_remaining,
                stop_reason: ProcessingStopReason::Cancelled,
                observed_local,
            });
        }

        if committed + already_fulfilled >= max_occurrences {
            let more_due_remaining = more_due_remaining(repository, observed_local).await?;
            return Ok(ProcessingSliceOutcome {
                committed,
                already_fulfilled,
                more_due_remaining,
                stop_reason: ProcessingStopReason::BudgetExhausted,
                observed_local,
            });
        }

        match repository.process_one_due_occurrence(observed_local).await {
            Ok(ProcessOneOutcome::Committed(_)) => {
                committed += 1;
                contention_started = None;
                contention_attempt = 0;
                if process_failpoints::should_fail_after(committed) {
                    return Err(Error::Repository(
                        "Injected failure between occurrence slices".to_string(),
                    ));
                }
                if slice_started.elapsed() >= work_budget.max_duration {
                    let more_due_remaining = more_due_remaining(repository, observed_local).await?;
                    return Ok(ProcessingSliceOutcome {
                        committed,
                        already_fulfilled,
                        more_due_remaining,
                        stop_reason: ProcessingStopReason::BudgetExhausted,
                        observed_local,
                    });
                }
            }
            Ok(ProcessOneOutcome::AlreadyFulfilled(_)) => {
                already_fulfilled += 1;
                contention_started = None;
                contention_attempt = 0;
                if slice_started.elapsed() >= work_budget.max_duration {
                    let more_due_remaining = more_due_remaining(repository, observed_local).await?;
                    return Ok(ProcessingSliceOutcome {
                        committed,
                        already_fulfilled,
                        more_due_remaining,
                        stop_reason: ProcessingStopReason::BudgetExhausted,
                        observed_local,
                    });
                }
            }
            Ok(ProcessOneOutcome::NoEligibleWork) => {
                return Ok(ProcessingSliceOutcome {
                    committed,
                    already_fulfilled,
                    more_due_remaining: false,
                    stop_reason: ProcessingStopReason::CaughtUp,
                    observed_local,
                });
            }
            Err(error) if error.is_transient_contention() => {
                let started = contention_started.get_or_insert_with(Instant::now);
                match next_contention_retry(contention_attempt, started.elapsed()) {
                    ContentionRetryDecision::RetryAfter(delay) => {
                        contention_attempt += 1;
                        tokio::time::sleep(delay).await;
                    }
                    ContentionRetryDecision::Exhausted => {
                        let more_due_remaining = more_due_remaining(repository, observed_local)
                            .await
                            .unwrap_or(true);
                        return Ok(ProcessingSliceOutcome {
                            committed,
                            already_fulfilled,
                            more_due_remaining,
                            stop_reason: ProcessingStopReason::TransientlyDelayed,
                            observed_local,
                        });
                    }
                }
            }
            Err(error) => return Err(error),
        }
    }
}

async fn more_due_remaining(
    repository: &dyn RecurringTransactionsRepositoryTrait,
    observed_local: NaiveDateTime,
) -> Result<bool> {
    match repository.has_eligible_due_work(observed_local).await {
        Ok(value) => Ok(value),
        // Concurrent BEGIN IMMEDIATE can surface Busy on the follow-up due-head read.
        Err(error) if error.is_transient_contention() => Ok(true),
        Err(error) => Err(error),
    }
}
