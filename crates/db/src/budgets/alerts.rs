use super::models::BudgetRow;
use super::projection::materialize_budget_silent;
use super::repository::{ProjectionState, projected_budget_from_connection};
use crate::domain_alerts::insert_domain_alert;
use crate::errors::{IntoStorage, StorageError};
use crate::schema::{budgets, domain_alerts};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use std::collections::{HashMap, HashSet};
use zai_core::features::budgets::alerts::{
    BUDGET_STATUS_PRODUCER_KEY, BudgetAlertMode, BudgetAlertScenario, PeriodAnnouncedStatuses,
    alerts_for_scenario, status_from_occurrence_suffix,
};
use zai_core::features::budgets::models::{Budget, BudgetPeriod, BudgetStatus};
use zai_core::features::domain_alerts::AlertInsertOutcome;

#[derive(Debug, Clone)]
pub(crate) struct BudgetAlertSnapshot {
    pub id: String,
    pub name: String,
    pub paused: bool,
    pub period_start: NaiveDateTime,
    pub period: BudgetPeriod,
}

pub(crate) fn snapshot_active_budgets(
    conn: &mut SqliteConnection,
    now: NaiveDateTime,
) -> crate::errors::Result<HashMap<String, BudgetAlertSnapshot>> {
    let rows = budgets::table
        .filter(budgets::deleted_at.is_null())
        .filter(budgets::paused.eq(false))
        .load::<BudgetRow>(conn)
        .into_storage()?;

    let mut snapshots = HashMap::new();
    for row in rows {
        if let Some(snapshot) = snapshot_budget(conn, &row.id, now)? {
            snapshots.insert(snapshot.id.clone(), snapshot);
        }
    }
    Ok(snapshots)
}

pub(crate) fn snapshot_budget(
    conn: &mut SqliteConnection,
    budget_id: &str,
    now: NaiveDateTime,
) -> crate::errors::Result<Option<BudgetAlertSnapshot>> {
    let row = budgets::table
        .filter(budgets::id.eq(budget_id))
        .filter(budgets::deleted_at.is_null())
        .first::<BudgetRow>(conn)
        .optional()
        .into_storage()?;
    let Some(row) = row else {
        return Ok(None);
    };
    if row.paused {
        return Ok(None);
    }

    let budget = match projected_budget_from_connection(conn, budget_id, now)? {
        ProjectionState::Current(budget) => budget,
        ProjectionState::NeedsMaterialization => materialize_budget_silent(conn, budget_id, now)?,
    };

    Ok(Some(BudgetAlertSnapshot {
        id: budget.id,
        name: budget.name,
        paused: budget.paused,
        period_start: budget.current_period.start,
        period: budget.current_period,
    }))
}

pub(crate) fn snapshot_budgets_by_ids(
    conn: &mut SqliteConnection,
    budget_ids: &[String],
    now: NaiveDateTime,
) -> crate::errors::Result<HashMap<String, BudgetAlertSnapshot>> {
    let mut snapshots = HashMap::new();
    for budget_id in budget_ids {
        if let Some(snapshot) = snapshot_budget(conn, budget_id, now)? {
            snapshots.insert(snapshot.id.clone(), snapshot);
        }
    }
    Ok(snapshots)
}

pub(crate) fn emit_budget_transition_alerts(
    conn: &mut SqliteConnection,
    mode: BudgetAlertMode,
    before: &HashMap<String, BudgetAlertSnapshot>,
    after: &HashMap<String, BudgetAlertSnapshot>,
) -> crate::errors::Result<Vec<AlertInsertOutcome>> {
    let budget_ids = before
        .keys()
        .chain(after.keys())
        .cloned()
        .collect::<HashSet<_>>();

    let mut outcomes = Vec::new();
    for budget_id in budget_ids {
        let Some(after_snapshot) = after.get(&budget_id) else {
            continue;
        };
        if after_snapshot.paused {
            continue;
        }

        let scenario = match before.get(&budget_id) {
            Some(before_snapshot)
                if before_snapshot.period_start == after_snapshot.period_start =>
            {
                BudgetAlertScenario::SamePeriodTransition {
                    before: before_snapshot.period.status,
                    after: after_snapshot.period.status,
                }
            }
            Some(_) | None => BudgetAlertScenario::PeriodAdvancement {
                final_status: after_snapshot.period.status,
            },
        };

        outcomes.extend(emit_budget_alert(
            conn,
            mode,
            scenario,
            &after_snapshot.id,
            &after_snapshot.name,
            &after_snapshot.period,
        )?);
    }
    Ok(outcomes)
}

pub(crate) fn emit_resume_budget_alert(
    conn: &mut SqliteConnection,
    budget: &Budget,
) -> crate::errors::Result<Vec<AlertInsertOutcome>> {
    emit_budget_alert(
        conn,
        BudgetAlertMode::Resume,
        BudgetAlertScenario::ResumeCurrent {
            status: budget.current_period.status,
        },
        &budget.id,
        &budget.name,
        &budget.current_period,
    )
}

fn emit_budget_alert(
    conn: &mut SqliteConnection,
    mode: BudgetAlertMode,
    scenario: BudgetAlertScenario,
    budget_id: &str,
    budget_name: &str,
    period: &BudgetPeriod,
) -> crate::errors::Result<Vec<AlertInsertOutcome>> {
    if mode == BudgetAlertMode::Silent {
        return Ok(Vec::new());
    }

    let announced = load_announced_statuses(conn, budget_id, period.start)?;
    let alerts = alerts_for_scenario(mode, scenario, announced, budget_id, budget_name, period)
        .map_err(StorageError::CoreError)?;

    let mut outcomes = Vec::with_capacity(alerts.len());
    for alert in alerts {
        outcomes.push(insert_domain_alert(conn, &alert)?);
    }
    Ok(outcomes)
}

pub(crate) fn load_announced_statuses(
    conn: &mut SqliteConnection,
    budget_id: &str,
    period_start: NaiveDateTime,
) -> crate::errors::Result<PeriodAnnouncedStatuses> {
    let prefix = format!(
        "v1:{budget_id}:{}:",
        zai_core::features::budgets::alerts::format_period_start_key(period_start)
    );
    let keys = domain_alerts::table
        .filter(domain_alerts::producer_key.eq(BUDGET_STATUS_PRODUCER_KEY))
        .filter(domain_alerts::occurrence_key.like(format!("{prefix}%")))
        .select(domain_alerts::occurrence_key)
        .load::<String>(conn)
        .into_storage()?;

    let mut announced = PeriodAnnouncedStatuses::default();
    for key in keys {
        let Some(suffix) = key.rsplit(':').next() else {
            continue;
        };
        match status_from_occurrence_suffix(suffix) {
            Some(BudgetStatus::Warning) => announced.warning = true,
            Some(BudgetStatus::Overspent) => announced.critical = true,
            _ => {}
        }
    }
    Ok(announced)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection::run_migrations;
    use crate::domain_alerts::insert_domain_alert;
    use crate::test_utils::TempDb;
    use chrono::NaiveDate;
    use diesel::r2d2::{self, Pool};
    use diesel::sqlite::SqliteConnection;
    use zai_core::features::budgets::alerts::occurrence_key;
    use zai_core::features::domain_alerts::{
        DomainAlertDestination, DomainAlertSeverity, NewDomainAlert,
    };

    fn setup_conn(temp_db: &TempDb) -> SqliteConnection {
        let manager = r2d2::ConnectionManager::<SqliteConnection>::new(temp_db.path());
        let pool = Pool::builder().build(manager).expect("pool");
        run_migrations(&pool).expect("migrations");
        SqliteConnection::establish(temp_db.path()).expect("connect")
    }

    #[test]
    fn announced_statuses_track_existing_occurrence_keys() {
        let temp_db = TempDb::new();
        let mut conn = setup_conn(&temp_db);
        let budget_id = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
        let period_start = NaiveDate::from_ymd_opt(2026, 7, 1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap();
        let warning_key = occurrence_key(budget_id, period_start, BudgetStatus::Warning);

        conn.immediate_transaction(|conn| {
            insert_domain_alert(
                conn,
                &NewDomainAlert {
                    id: None,
                    producer_key: BUDGET_STATUS_PRODUCER_KEY.to_string(),
                    occurrence_key: warning_key,
                    severity: DomainAlertSeverity::Warning,
                    title: "Warning".to_string(),
                    body: "Body".to_string(),
                    destination: Some(DomainAlertDestination::Budget {
                        budget_id: budget_id.to_string(),
                    }),
                    data: None,
                },
            )
        })
        .expect("insert");

        let announced = load_announced_statuses(&mut conn, budget_id, period_start).expect("load");
        assert!(announced.warning);
        assert!(!announced.critical);
    }
}
