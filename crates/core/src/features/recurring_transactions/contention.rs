use std::time::Duration;

pub const CONTENTION_RETRY_DELAYS_MS: [u64; 3] = [25, 50, 100];
pub const CONTENTION_TOTAL_BUDGET: Duration = Duration::from_millis(500);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContentionRetryDecision {
    RetryAfter(Duration),
    Exhausted,
}

pub fn next_contention_retry(attempt_index: u32, elapsed: Duration) -> ContentionRetryDecision {
    if elapsed >= CONTENTION_TOTAL_BUDGET {
        return ContentionRetryDecision::Exhausted;
    }
    let Some(delay_ms) = CONTENTION_RETRY_DELAYS_MS
        .get(attempt_index as usize)
        .copied()
    else {
        return ContentionRetryDecision::Exhausted;
    };
    let delay = Duration::from_millis(delay_ms);
    if elapsed + delay > CONTENTION_TOTAL_BUDGET {
        return ContentionRetryDecision::Exhausted;
    }
    ContentionRetryDecision::RetryAfter(delay)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retries_use_contract_delays_within_budget() {
        assert_eq!(
            next_contention_retry(0, Duration::from_millis(0)),
            ContentionRetryDecision::RetryAfter(Duration::from_millis(25))
        );
        assert_eq!(
            next_contention_retry(1, Duration::from_millis(25)),
            ContentionRetryDecision::RetryAfter(Duration::from_millis(50))
        );
        assert_eq!(
            next_contention_retry(2, Duration::from_millis(75)),
            ContentionRetryDecision::RetryAfter(Duration::from_millis(100))
        );
        assert_eq!(
            next_contention_retry(3, Duration::from_millis(175)),
            ContentionRetryDecision::Exhausted
        );
    }

    #[test]
    fn exhaustion_respects_total_budget() {
        assert_eq!(
            next_contention_retry(0, Duration::from_millis(480)),
            ContentionRetryDecision::Exhausted
        );
    }
}
