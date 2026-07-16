use diesel::connection::{Connection, InstrumentationEvent, SimpleConnection};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

pub(crate) struct ConnectionStatementCounter {
    count: Arc<AtomicUsize>,
}

impl ConnectionStatementCounter {
    pub(crate) fn install(conn: &mut SqliteConnection) -> Self {
        let count = Arc::new(AtomicUsize::new(0));
        let hook = Arc::clone(&count);
        conn.set_instrumentation(move |event: InstrumentationEvent<'_>| {
            if let InstrumentationEvent::StartQuery { query, .. } = event {
                let sql = query.to_string();
                if sql.contains("PRAGMA") {
                    return;
                }
                hook.fetch_add(1, Ordering::SeqCst);
            }
        });
        // Force instrumentation install before measured work; ignore result.
        let _ = conn.batch_execute("SELECT 1");
        count.store(0, Ordering::SeqCst);
        Self { count }
    }

    pub(crate) fn count(&self) -> usize {
        self.count.load(Ordering::SeqCst)
    }
}
