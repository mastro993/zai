use crate::connection::{DbPool, get_connection};
use crate::errors::IntoCore;
use diesel::RunQueryDsl;
use diesel::prelude::QueryableByName;
use diesel::sql_query;
use diesel::sql_types::{Bool, Text};
use zai_core::Result;
use zai_core::features::currency::PersistedCurrency;

#[derive(QueryableByName)]
struct PersistedRow {
    #[diesel(sql_type = Text)]
    code: String,
    #[diesel(sql_type = Bool)]
    disabled: bool,
    #[diesel(sql_type = Bool)]
    used_by_recurring: bool,
}

pub fn list_persisted(pool: &DbPool) -> Result<Vec<PersistedCurrency>> {
    let mut connection = get_connection(pool)?;
    let rows = sql_query(
        "SELECT e.code AS code, \
                (e.disabled_at IS NOT NULL) AS disabled, \
                EXISTS ( \
                    SELECT 1 \
                    FROM recurring_template_revisions rtr \
                    INNER JOIN recurring_transactions rt \
                        ON rt.id = rtr.recurring_transaction_id \
                    WHERE rtr.currency = e.code \
                      AND rt.deleted_at IS NULL \
                ) AS used_by_recurring \
         FROM enabled_currencies e \
         ORDER BY e.code",
    )
    .load::<PersistedRow>(&mut connection)
    .into_core()?;
    Ok(rows
        .into_iter()
        .map(|row| PersistedCurrency {
            code: row.code,
            disabled: row.disabled,
            used_by_recurring: row.used_by_recurring,
        })
        .collect())
}
