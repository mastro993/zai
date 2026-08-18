use super::{application_format_present, complete_initial_setup};
use crate::connection::{
    DbPool, create_pool, get_connection, pre_currency_backup_path, run_migrations,
};
use crate::errors::IntoCore;
use diesel::{RunQueryDsl, sql_query};
use log::info;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use zai_core::{DatabaseError, Error, Result};

const CONFIRM_DEFAULT_CURRENCY_ENV: &str = "ZAI_CONFIRM_DEFAULT_CURRENCY";

pub(crate) fn activate_currency_schema(db_path: &Path) -> Result<Arc<DbPool>> {
    let pool = create_pool(db_path)?;
    let needs_currency_activation = !format_present(&pool)?;
    if needs_currency_activation {
        create_pre_currency_backup(db_path, &pool)?;
        #[cfg(any(test, feature = "failpoints"))]
        super::failpoints::hit(
            super::failpoints::CurrencyMigrationFailpoint::AfterBackupBeforeMigrate,
        )?;
    }

    if let Err(error) = run_migrations(&pool).and_then(|()| verify_currency_activation(&pool)) {
        if needs_currency_activation {
            drop(pool);
            restore_pre_currency_backup(db_path)?;
        }
        return Err(error);
    }

    if needs_currency_activation {
        #[cfg(any(test, feature = "failpoints"))]
        if let Err(error) = super::failpoints::hit(
            super::failpoints::CurrencyMigrationFailpoint::AfterMigrateBeforeOpen,
        ) {
            drop(pool);
            restore_pre_currency_backup(db_path)?;
            return Err(error);
        }
    }

    Ok(pool)
}

pub(crate) fn maybe_confirm_default_currency(pool: &DbPool) -> Result<()> {
    let Some(code) = env::var(CONFIRM_DEFAULT_CURRENCY_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    else {
        return Ok(());
    };
    complete_initial_setup(pool, &code)
}

fn format_present(pool: &DbPool) -> Result<bool> {
    let mut connection = get_connection(pool)?;
    application_format_present(&mut connection)
}

fn verify_currency_activation(pool: &DbPool) -> Result<()> {
    if format_present(pool)? {
        Ok(())
    } else {
        Err(Error::Database(DatabaseError::MigrationFailed(
            "currency activation did not record application format".to_string(),
        )))
    }
}

fn create_pre_currency_backup(db_path: &Path, pool: &DbPool) -> Result<()> {
    let backup_path = pre_currency_backup_path(db_path);
    if backup_path.exists() {
        fs::remove_file(&backup_path).map_err(|err| {
            Error::Database(DatabaseError::Internal(format!(
                "failed to replace pre-currency backup: {err}"
            )))
        })?;
    }
    let mut connection = get_connection(pool)?;
    sql_query("PRAGMA wal_checkpoint(TRUNCATE)")
        .execute(&mut connection)
        .into_core()?;
    let escaped = backup_path.to_string_lossy().replace('\'', "''");
    sql_query(format!("VACUUM INTO '{escaped}'"))
        .execute(&mut connection)
        .into_core()?;
    info!(
        "Created pre-multi-currency backup at {}",
        backup_path.display()
    );
    Ok(())
}

fn restore_pre_currency_backup(db_path: &Path) -> Result<()> {
    let backup_path = pre_currency_backup_path(db_path);
    if !backup_path.exists() {
        return Err(Error::Database(DatabaseError::MigrationFailed(
            "currency migration failed and no pre-currency backup exists".to_string(),
        )));
    }
    remove_sqlite_sidecars(db_path);
    fs::copy(&backup_path, db_path).map_err(|err| {
        Error::Database(DatabaseError::MigrationFailed(format!(
            "failed to restore pre-currency backup: {err}"
        )))
    })?;
    info!(
        "Restored pre-multi-currency backup from {}",
        backup_path.display()
    );
    Ok(())
}

fn remove_sqlite_sidecars(db_path: &Path) {
    for suffix in ["-wal", "-shm"] {
        let mut sidecar = db_path.as_os_str().to_owned();
        sidecar.push(suffix);
        let sidecar = PathBuf::from(sidecar);
        if sidecar.exists() {
            let _ = fs::remove_file(sidecar);
        }
    }
}
