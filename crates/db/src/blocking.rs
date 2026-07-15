use zai_core::{Error, Result};

pub(crate) async fn run_blocking<T, F>(work: F) -> Result<T>
where
    F: FnOnce() -> Result<T> + Send + 'static,
    T: Send + 'static,
{
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|_| Error::Repository("database blocking task failed".to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::thread;

    #[tokio::test(flavor = "current_thread")]
    async fn run_blocking_executes_off_runtime_thread() {
        let runtime_tid = thread::current().id();
        let job_tid = run_blocking(|| Ok(thread::current().id()))
            .await
            .expect("blocking work");
        assert_ne!(job_tid, runtime_tid);
    }

    #[tokio::test(flavor = "current_thread")]
    async fn run_blocking_does_not_starve_current_thread_runtime() {
        let (entered_tx, entered_rx) = mpsc::channel();
        let (resume_tx, resume_rx) = mpsc::channel::<()>();

        let blocking = tokio::spawn(async move {
            run_blocking(move || {
                entered_tx.send(thread::current().id()).expect("entered");
                resume_rx.recv().expect("resume");
                Ok(())
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
            .expect("runtime should progress while blocking work waits");

        resume_tx.send(()).expect("resume");
        blocking
            .await
            .expect("join")
            .expect("blocking work should complete");
    }
}
