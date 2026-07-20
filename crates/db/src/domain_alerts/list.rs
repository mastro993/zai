use super::models::{DomainAlertRow, build_domain_alert};
use crate::blocking::run_blocking;
use crate::connection::{DbPool, get_connection};
use crate::errors::IntoCore;
use crate::schema::domain_alerts;
use diesel::dsl::count_star;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;
use zai_core::Result;
use zai_core::features::domain_alerts::{
    DomainAlertListPage, DomainAlertReadState, DomainAlertSeverity, ListDomainAlertsQuery,
    decode_cursor, encode_cursor,
};

pub fn list_domain_alerts(
    conn: &mut SqliteConnection,
    query: &ListDomainAlertsQuery,
) -> Result<DomainAlertListPage> {
    let limit = query.normalized_limit()?;
    let read_state = query.normalized_read_state();
    let severities = query.severities.as_ref().map(|values| {
        values
            .iter()
            .copied()
            .map(DomainAlertSeverity::as_str)
            .collect::<Vec<_>>()
    });

    let mut db_query = domain_alerts::table.into_boxed();
    db_query = match read_state {
        DomainAlertReadState::All => db_query,
        DomainAlertReadState::Read => db_query.filter(domain_alerts::read_at.is_not_null()),
        DomainAlertReadState::Unread => db_query
            .filter(domain_alerts::read_at.is_null())
            .filter(domain_alerts::resolved_at.is_null()),
    };
    if let Some(severity_values) = &severities {
        db_query = db_query.filter(domain_alerts::severity.eq_any(severity_values));
    }
    if let Some(cursor) = &query.cursor {
        let decoded = decode_cursor(cursor)?;
        db_query = db_query.filter(
            domain_alerts::created_at
                .lt(decoded.created_at)
                .or(domain_alerts::created_at
                    .eq(decoded.created_at)
                    .and(domain_alerts::id.lt(decoded.id))),
        );
    }

    let rows = db_query
        .order((domain_alerts::created_at.desc(), domain_alerts::id.desc()))
        .limit(limit + 1)
        .select(DomainAlertRow::as_select())
        .load::<DomainAlertRow>(conn)
        .into_core()?;

    let has_more = rows.len() as i64 > limit;
    let mut items = Vec::new();
    let mut last_row: Option<DomainAlertRow> = None;
    for row in rows.into_iter().take(limit as usize) {
        last_row = Some(row.clone());
        items.push(build_domain_alert(row)?);
    }

    let next_cursor = if has_more {
        last_row.map(|row| encode_cursor(row.created_at, &row.id))
    } else {
        None
    };

    Ok(DomainAlertListPage { items, next_cursor })
}

pub fn unread_domain_alert_count(conn: &mut SqliteConnection) -> Result<i64> {
    domain_alerts::table
        .filter(domain_alerts::read_at.is_null())
        .filter(domain_alerts::resolved_at.is_null())
        .select(count_star())
        .first::<i64>(conn)
        .into_core()
}

pub async fn list_domain_alerts_from_pool(
    pool: &Arc<DbPool>,
    query: &ListDomainAlertsQuery,
) -> Result<DomainAlertListPage> {
    let query = query.clone();
    let pool = Arc::clone(pool);
    run_blocking(move || {
        let mut conn = get_connection(&pool)?;
        list_domain_alerts(&mut conn, &query)
    })
    .await
}

pub async fn unread_domain_alert_count_from_pool(pool: &Arc<DbPool>) -> Result<i64> {
    let pool = Arc::clone(pool);
    run_blocking(move || {
        let mut conn = get_connection(&pool)?;
        unread_domain_alert_count(&mut conn)
    })
    .await
}
