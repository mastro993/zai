use chrono::{NaiveDate, NaiveDateTime};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;
use zai_core::features::budgets::traits::CalendarClock;

pub struct FixedCalendarClock;

impl CalendarClock for FixedCalendarClock {
    fn sample(&self) -> NaiveDateTime {
        fixed_local()
    }
}

pub fn fixed_local() -> NaiveDateTime {
    NaiveDate::from_ymd_opt(2026, 7, 24)
        .expect("fixed date")
        .and_hms_opt(12, 0, 0)
        .expect("fixed time")
}

pub struct TempDb {
    path: PathBuf,
}

impl TempDb {
    pub fn new() -> Self {
        let file_name = format!("zai-test-{}.db", Uuid::new_v4());
        let path = std::env::temp_dir().join(file_name);
        fs::File::create(&path).expect("Failed to create temp.db");
        Self { path }
    }

    pub fn path(&self) -> &str {
        self.path.to_str().unwrap()
    }

    fn remove_sidecar(path: &std::path::Path, suffix: &str) {
        let mut sidecar = path.as_os_str().to_owned();
        sidecar.push(suffix);
        let sidecar = PathBuf::from(sidecar);
        if sidecar.exists() {
            let _ = fs::remove_file(&sidecar);
        }
    }
}

impl Drop for TempDb {
    fn drop(&mut self) {
        Self::remove_sidecar(&self.path, "-wal");
        Self::remove_sidecar(&self.path, "-shm");
        if self.path.exists() {
            let _ = fs::remove_file(&self.path);
        }
    }
}
