use std::sync::atomic::{AtomicU32, Ordering};

static FAIL_AFTER_COMMITS: AtomicU32 = AtomicU32::new(u32::MAX);

/// Test-only injection points. Default state is disarmed (`u32::MAX`).
pub fn reset() {
    FAIL_AFTER_COMMITS.store(u32::MAX, Ordering::SeqCst);
}

pub fn fail_after_commits(count: u32) {
    FAIL_AFTER_COMMITS.store(count, Ordering::SeqCst);
}

pub fn should_fail_after(committed: u32) -> bool {
    let armed = FAIL_AFTER_COMMITS.load(Ordering::SeqCst);
    armed != u32::MAX && committed >= armed
}
