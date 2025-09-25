use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

pub struct TempDb {
    path: PathBuf,
}

impl TempDb {
    pub fn new() -> Self {
        let file_name = format!("{}.db", Uuid::new_v4());
        let path = PathBuf::from(file_name);
        fs::File::create(&path).expect("Failed to create temp.db");
        Self { path }
    }

    pub fn path(&self) -> &str {
        self.path.to_str().unwrap()
    }
}

impl Drop for TempDb {
    fn drop(&mut self) {
        if self.path.exists() {
            fs::remove_file(&self.path).expect("Failed to delete temp.db");
        }
    }
}
