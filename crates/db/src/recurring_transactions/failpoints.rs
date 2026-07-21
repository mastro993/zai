use crate::errors::{Result, StorageError};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Barrier, Mutex, OnceLock};
use zai_core::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum FulfillmentFailpoint {
    None = 0,
    BeforeSideEffects = 1,
    AfterTransactionInsert = 2,
    AfterAlertInsert = 3,
    AfterOccurrenceInsert = 4,
    AfterHeadAdvance = 5,
    AfterBudgetReconcile = 6,
    AfterCommitBeforeReply = 7,
}

impl FulfillmentFailpoint {
    fn from_u8(value: u8) -> Self {
        match value {
            1 => Self::BeforeSideEffects,
            2 => Self::AfterTransactionInsert,
            3 => Self::AfterAlertInsert,
            4 => Self::AfterOccurrenceInsert,
            5 => Self::AfterHeadAdvance,
            6 => Self::AfterBudgetReconcile,
            7 => Self::AfterCommitBeforeReply,
            _ => Self::None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
enum FailpointMode {
    Error = 0,
    ExitProcess = 1,
    Wait = 2,
}

static ARMED: AtomicU8 = AtomicU8::new(0);
static MODE: AtomicU8 = AtomicU8::new(0);
static WAIT_BARRIER: OnceLock<Mutex<Option<Arc<Barrier>>>> = OnceLock::new();

fn barrier_slot() -> &'static Mutex<Option<Arc<Barrier>>> {
    WAIT_BARRIER.get_or_init(|| Mutex::new(None))
}

pub fn reset() {
    ARMED.store(0, Ordering::SeqCst);
    MODE.store(0, Ordering::SeqCst);
    *barrier_slot().lock().expect("failpoint barrier") = None;
}

#[allow(dead_code)]
pub fn arm_error(site: FulfillmentFailpoint) {
    reset();
    MODE.store(FailpointMode::Error as u8, Ordering::SeqCst);
    ARMED.store(site as u8, Ordering::SeqCst);
}

pub fn arm_exit(site: FulfillmentFailpoint) {
    reset();
    MODE.store(FailpointMode::ExitProcess as u8, Ordering::SeqCst);
    ARMED.store(site as u8, Ordering::SeqCst);
}

#[allow(dead_code)]
pub fn arm_wait(site: FulfillmentFailpoint, barrier: Arc<Barrier>) {
    reset();
    MODE.store(FailpointMode::Wait as u8, Ordering::SeqCst);
    *barrier_slot().lock().expect("failpoint barrier") = Some(barrier);
    ARMED.store(site as u8, Ordering::SeqCst);
}

#[allow(dead_code)]
pub fn armed() -> FulfillmentFailpoint {
    FulfillmentFailpoint::from_u8(ARMED.load(Ordering::SeqCst))
}

fn mode() -> FailpointMode {
    match MODE.load(Ordering::SeqCst) {
        x if x == FailpointMode::ExitProcess as u8 => FailpointMode::ExitProcess,
        x if x == FailpointMode::Wait as u8 => FailpointMode::Wait,
        _ => FailpointMode::Error,
    }
}

pub fn hit(site: FulfillmentFailpoint) -> Result<()> {
    if armed() != site {
        return Ok(());
    }
    match mode() {
        FailpointMode::Wait => {
            let barrier = barrier_slot()
                .lock()
                .expect("failpoint barrier")
                .clone()
                .expect("wait barrier armed");
            barrier.wait();
            Ok(())
        }
        FailpointMode::ExitProcess => {
            std::process::exit(101);
        }
        FailpointMode::Error => Err(StorageError::CoreError(Error::Repository(format!(
            "Injected fulfillment failure at {site:?}"
        )))),
    }
}

/// Returns true when the writer should replace a successful commit reply with an error
/// (lost-reply / crash-after-commit simulation).
pub fn hit_after_commit_before_reply() -> bool {
    if armed() != FulfillmentFailpoint::AfterCommitBeforeReply {
        return false;
    }
    match mode() {
        FailpointMode::Wait => {
            let barrier = barrier_slot()
                .lock()
                .expect("failpoint barrier")
                .clone()
                .expect("wait barrier armed");
            barrier.wait();
            false
        }
        FailpointMode::ExitProcess => {
            std::process::exit(101);
        }
        FailpointMode::Error => true,
    }
}
