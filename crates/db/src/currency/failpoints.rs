use std::cell::Cell;
use zai_core::{DatabaseError, Error, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum CurrencyMigrationFailpoint {
    None = 0,
    AfterBackupBeforeMigrate = 1,
    AfterMigrateBeforeOpen = 2,
}

impl CurrencyMigrationFailpoint {
    fn from_u8(value: u8) -> Self {
        match value {
            1 => Self::AfterBackupBeforeMigrate,
            2 => Self::AfterMigrateBeforeOpen,
            _ => Self::None,
        }
    }
}

thread_local! {
    static ARMED: Cell<u8> = const { Cell::new(0) };
}

pub fn reset() {
    ARMED.with(|armed| armed.set(0));
}

pub fn arm(site: CurrencyMigrationFailpoint) {
    ARMED.with(|armed| armed.set(site as u8));
}

pub fn hit(site: CurrencyMigrationFailpoint) -> Result<()> {
    let armed = ARMED.with(Cell::get);
    if CurrencyMigrationFailpoint::from_u8(armed) == site {
        reset();
        return Err(Error::Database(DatabaseError::MigrationFailed(
            "currency migration failpoint".to_string(),
        )));
    }
    Ok(())
}
