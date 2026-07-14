use crate::connection::DbPool;
use crate::errors::{IntoCore, Result};
use diesel::SqliteConnection;
use std::any::Any;
#[cfg(test)]
use std::sync::atomic::{AtomicUsize, Ordering};
use tokio::sync::{mpsc, oneshot};
use zai_core::{DatabaseError, Error};

#[cfg(test)]
static WRITER_EXEC_COUNT: AtomicUsize = AtomicUsize::new(0);

#[cfg(test)]
pub(crate) fn reset_writer_exec_count() {
    WRITER_EXEC_COUNT.store(0, Ordering::SeqCst);
}

#[cfg(test)]
pub(crate) fn writer_exec_count() -> usize {
    WRITER_EXEC_COUNT.load(Ordering::SeqCst)
}

type Job<T> = Box<dyn FnOnce(&mut SqliteConnection) -> Result<T> + Send + 'static>;
type BoxedValue = Box<dyn Any + Send + 'static>;
type WriterMessage = (Job<BoxedValue>, oneshot::Sender<Result<BoxedValue>>);

#[derive(Clone)]
pub(crate) struct WriteHandle {
    tx: mpsc::Sender<WriterMessage>,
}

impl WriteHandle {
    pub async fn exec<F, T>(&self, job: F) -> zai_core::Result<T>
    where
        F: FnOnce(&mut SqliteConnection) -> Result<T> + Send + 'static,
        T: Send + 'static + Any,
    {
        let (ret_tx, ret_rx) = oneshot::channel();

        #[cfg(test)]
        WRITER_EXEC_COUNT.fetch_add(1, Ordering::SeqCst);

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
    let mut conn = pool.get().into_core()?;
    let handle = tokio::runtime::Handle::try_current()
        .map_err(|err| writer_error(&format!("missing Tokio runtime: {err}")))?;
    let (tx, mut rx) = mpsc::channel::<WriterMessage>(1024);

    handle.spawn(async move {
        while let Some((job, reply_tx)) = rx.recv().await {
            let result = conn.immediate_transaction(|conn| job(conn));
            let _ = reply_tx.send(result);
        }
    });

    Ok(WriteHandle { tx })
}

fn writer_error(message: &str) -> Error {
    Error::Database(DatabaseError::Internal(message.to_string()))
}
