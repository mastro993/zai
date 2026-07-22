use crate::errors::IntoCore;
use crate::schema::recurring_transactions;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::recurring_transactions::RecurringMatchingIdentity;

pub fn list_matching_ids(conn: &mut SqliteConnection) -> Result<Vec<RecurringMatchingIdentity>> {
    let rows = recurring_transactions::table
        .filter(recurring_transactions::deleted_at.is_null())
        .order((
            recurring_transactions::updated_at.desc(),
            recurring_transactions::id.desc(),
        ))
        .select((recurring_transactions::id, recurring_transactions::revision))
        .load::<(String, i32)>(conn)
        .into_core()?;
    Ok(rows
        .into_iter()
        .map(|(id, revision)| RecurringMatchingIdentity {
            recurring_transaction_id: id,
            expected_revision: revision,
        })
        .collect())
}
