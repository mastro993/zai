use crate::connection::DbPool;
use crate::errors::{IntoCore, Result};
use diesel::SqliteConnection;
use diesel::connection::SimpleConnection;
use std::any::Any;
#[cfg(test)]
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
use tokio::sync::{mpsc, oneshot};
use zai_core::{DatabaseError, Error};

type Job<T> = Box<dyn FnOnce(&mut SqliteConnection) -> Result<T> + Send + 'static>;
type BoxedValue = Box<dyn Any + Send + 'static>;
type WriterMessage = (Job<BoxedValue>, oneshot::Sender<Result<BoxedValue>>);
const WRITE_QUEUE_CAPACITY: usize = 1024;

#[derive(Clone)]
pub(crate) struct WriteHandle {
    tx: mpsc::Sender<WriterMessage>,
    #[cfg(test)]
    exec_count: Arc<AtomicUsize>,
}

impl WriteHandle {
    #[cfg(test)]
    pub(crate) fn reset_exec_count(&self) {
        self.exec_count.store(0, Ordering::SeqCst);
    }

    #[cfg(test)]
    pub(crate) fn exec_count(&self) -> usize {
        self.exec_count.load(Ordering::SeqCst)
    }

    pub async fn exec<F, T>(&self, job: F) -> zai_core::Result<T>
    where
        F: FnOnce(&mut SqliteConnection) -> Result<T> + Send + 'static,
        T: Send + 'static + Any,
    {
        let (ret_tx, ret_rx) = oneshot::channel();

        #[cfg(test)]
        self.exec_count.fetch_add(1, Ordering::SeqCst);

        self.tx
            .send((
                Box::new(move |conn| job(conn).map(|value| Box::new(value) as Box<dyn Any + Send>)),
                ret_tx,
            ))
            .await
            .map_err(|_| writer_error("database writer stopped"))?;

        ret_rx
            .await
            .map_err(|_| writer_error("database writer dropped the reply"))?
            .into_core()
            .map(|boxed| {
                *boxed
                    .downcast::<T>()
                    .unwrap_or_else(|_| panic!("database writer returned the wrong result type"))
            })
    }
}

pub(crate) fn spawn_writer(pool: DbPool) -> zai_core::Result<WriteHandle> {
    spawn_writer_with_capacity(pool, WRITE_QUEUE_CAPACITY)
}

fn spawn_writer_with_capacity(
    pool: DbPool,
    queue_capacity: usize,
) -> zai_core::Result<WriteHandle> {
    let mut conn = pool.get().into_core()?;
    conn.batch_execute("PRAGMA busy_timeout = 100;")
        .map_err(|err| writer_error(&format!("failed to set writer busy_timeout: {err}")))?;
    let handle = tokio::runtime::Handle::try_current()
        .map_err(|err| writer_error(&format!("missing Tokio runtime: {err}")))?;
    let (tx, mut rx) = mpsc::channel::<WriterMessage>(queue_capacity);

    std::thread::Builder::new()
        .name("zai-db-writer".into())
        .spawn(move || {
            while let Some((job, reply_tx)) = handle.block_on(rx.recv()) {
                let result = conn.immediate_transaction(|conn| job(conn));
                #[cfg(any(test, feature = "failpoints"))]
                let result = {
                    use crate::recurring_transactions::failpoints;
                    if result.is_ok() && failpoints::hit_after_commit_before_reply() {
                        Err(crate::errors::StorageError::CoreError(
                            zai_core::Error::Repository(
                                "Injected fulfillment failure after commit before reply"
                                    .to_string(),
                            ),
                        ))
                    } else {
                        result
                    }
                };
                let _ = reply_tx.send(result);
            }
        })
        .map_err(|err| writer_error(&format!("failed to spawn database writer: {err}")))?;

    Ok(WriteHandle {
        tx,
        #[cfg(test)]
        exec_count: Arc::new(AtomicUsize::new(0)),
    })
}

fn writer_error(message: &str) -> Error {
    Error::Database(DatabaseError::Internal(message.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection::run_migrations;
    use crate::errors::StorageError;
    use crate::test_utils::TempDb;
    use diesel::r2d2::{self, Pool};
    use diesel::sqlite::SqliteConnection;
    use std::sync::{Arc, Mutex, mpsc};
    use std::thread;

    fn setup_writer(temp_db: &TempDb) -> WriteHandle {
        setup_writer_with_capacity(temp_db, WRITE_QUEUE_CAPACITY)
    }

    fn setup_writer_with_capacity(temp_db: &TempDb, queue_capacity: usize) -> WriteHandle {
        let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
        let pool = Pool::builder().build(manager).expect("pool");
        run_migrations(&pool).expect("migrations");
        spawn_writer_with_capacity(pool, queue_capacity).expect("writer")
    }

    #[tokio::test(flavor = "current_thread")]
    async fn writer_executes_jobs_off_runtime_thread() {
        let temp_db = TempDb::new();
        let writer = setup_writer(&temp_db);
        let runtime_tid = thread::current().id();
        let job_tid = writer
            .exec(|_conn| Ok(thread::current().id()))
            .await
            .expect("write");
        assert_ne!(job_tid, runtime_tid);
    }

    #[tokio::test(flavor = "current_thread")]
    async fn writer_jobs_do_not_starve_current_thread_runtime() {
        let temp_db = TempDb::new();
        let writer = setup_writer(&temp_db);
        let (entered_tx, entered_rx) = mpsc::channel();
        let (resume_tx, resume_rx) = mpsc::channel::<()>();

        let write = tokio::spawn(async move {
            writer
                .exec(move |_conn| {
                    entered_tx.send(thread::current().id()).expect("entered");
                    resume_rx.recv().expect("resume");
                    Ok(42_i32)
                })
                .await
        });

        let job_tid = tokio::task::spawn_blocking(move || entered_rx.recv())
            .await
            .expect("join")
            .expect("entered");
        assert_ne!(job_tid, thread::current().id());

        let (tx, rx) = tokio::sync::oneshot::channel();
        tokio::spawn(async move {
            let _ = tx.send(());
        });
        rx.await
            .expect("runtime should progress while writer job waits");

        resume_tx.send(()).expect("resume");
        assert_eq!(write.await.expect("join").expect("write"), 42);
    }

    #[tokio::test]
    async fn writer_preserves_fifo_order() {
        let temp_db = TempDb::new();
        let writer = setup_writer(&temp_db);
        let seen = Arc::new(Mutex::new(Vec::new()));

        let mut handles = Vec::new();
        for i in 0..8 {
            let writer = writer.clone();
            let seen = Arc::clone(&seen);
            handles.push(tokio::spawn(async move {
                writer
                    .exec(move |_conn| {
                        seen.lock().expect("seen").push(i);
                        Ok(())
                    })
                    .await
            }));
        }

        for handle in handles {
            handle.await.expect("join").expect("write");
        }

        assert_eq!(*seen.lock().expect("seen"), (0..8).collect::<Vec<_>>());
    }

    #[tokio::test]
    async fn writer_continues_after_failed_job() {
        let temp_db = TempDb::new();
        let writer = setup_writer(&temp_db);

        let failed: zai_core::Result<i32> = writer
            .exec(|_conn| {
                Err(StorageError::CoreError(Error::InvalidData(
                    "boom".to_string(),
                )))
            })
            .await;
        assert!(failed.is_err());

        let ok = writer.exec(|_conn| Ok(7_i32)).await.expect("later job");
        assert_eq!(ok, 7);
    }

    #[tokio::test]
    async fn writer_exec_count_is_scoped_to_each_handle() {
        let first_db = TempDb::new();
        let second_db = TempDb::new();
        let first = setup_writer(&first_db);
        let second = setup_writer(&second_db);

        first.reset_exec_count();
        second.reset_exec_count();
        first.exec(|_conn| Ok(())).await.expect("first write");

        assert_eq!(second.exec_count(), 0);
    }

    #[tokio::test]
    async fn aborted_caller_does_not_stop_writer() {
        let temp_db = TempDb::new();
        let writer = setup_writer(&temp_db);
        let (entered_tx, entered_rx) = mpsc::channel();
        let (resume_tx, resume_rx) = mpsc::channel::<()>();

        let blocked = {
            let writer = writer.clone();
            tokio::spawn(async move {
                writer
                    .exec(move |_conn| {
                        entered_tx.send(()).expect("entered");
                        resume_rx.recv().expect("resume");
                        Ok(1_i32)
                    })
                    .await
            })
        };

        tokio::task::spawn_blocking(move || entered_rx.recv())
            .await
            .expect("join")
            .expect("entered");
        blocked.abort();
        resume_tx.send(()).expect("resume");

        let ok = writer.exec(|_conn| Ok(2_i32)).await.expect("later job");
        assert_eq!(ok, 2);
    }

    #[tokio::test]
    async fn writer_queue_rejects_work_beyond_capacity() {
        let temp_db = TempDb::new();
        let writer = setup_writer_with_capacity(&temp_db, 1);
        let (entered_tx, entered_rx) = mpsc::channel();
        let (resume_tx, resume_rx) = mpsc::channel::<()>();

        let blocked = {
            let writer = writer.clone();
            tokio::spawn(async move {
                writer
                    .exec(move |_conn| {
                        entered_tx.send(()).expect("entered");
                        resume_rx.recv().expect("resume");
                        Ok(())
                    })
                    .await
            })
        };
        tokio::task::spawn_blocking(move || entered_rx.recv())
            .await
            .expect("join")
            .expect("entered");

        let (queued_reply_tx, queued_reply_rx) = oneshot::channel();
        writer
            .tx
            .try_send((
                Box::new(|_conn| Ok(Box::new(()) as BoxedValue)),
                queued_reply_tx,
            ))
            .expect("one queued job should fit");
        let (overflow_reply_tx, _overflow_reply_rx) = oneshot::channel();
        let overflow = writer.tx.try_send((
            Box::new(|_conn| Ok(Box::new(()) as BoxedValue)),
            overflow_reply_tx,
        ));

        assert!(matches!(
            overflow,
            Err(tokio::sync::mpsc::error::TrySendError::Full(_))
        ));

        resume_tx.send(()).expect("resume");
        blocked.await.expect("join").expect("blocked write");
        queued_reply_rx
            .await
            .expect("queued reply")
            .expect("queued write");
    }
}
