use crate::errors::IntoCore;
use crate::schema::{
    recurring_generation_failures, recurring_template_revisions, recurring_transactions,
};
use diesel::expression_methods::EscapeExpressionMethods;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use zai_core::Result;
use zai_core::features::recurring_transactions::{
    MAX_BULK_SELECTION, RecurringFeedFilters, RecurringMatchingIdentity,
};

fn escape_like(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

pub fn list_matching_ids_filtered(
    conn: &mut SqliteConnection,
    filters: &RecurringFeedFilters,
) -> Result<Vec<RecurringMatchingIdentity>> {
    let filters = filters.normalized()?;
    let mut query = recurring_transactions::table
        .filter(recurring_transactions::deleted_at.is_null())
        .inner_join(
            recurring_template_revisions::table.on(
                recurring_template_revisions::recurring_transaction_id
                    .eq(recurring_transactions::id)
                    .and(recurring_template_revisions::effective_until_local.is_null()),
            ),
        )
        .left_join(
            recurring_generation_failures::table.on(
                recurring_generation_failures::recurring_transaction_id
                    .eq(recurring_transactions::id)
                    .and(recurring_generation_failures::resolved_at.is_null()),
            ),
        )
        .into_boxed();
    if let Some(search) = filters.search {
        query = query.filter(
            recurring_template_revisions::description
                .like(format!("%{}%", escape_like(&search)))
                .escape('\\'),
        );
    }
    if let Some(lifecycle) = filters.lifecycle {
        query = query.filter(recurring_transactions::lifecycle.eq(lifecycle.as_str()));
    }
    if let Some(needs_attention) = filters.needs_attention {
        query = if needs_attention {
            query.filter(recurring_generation_failures::recurring_transaction_id.is_not_null())
        } else {
            query.filter(recurring_generation_failures::recurring_transaction_id.is_null())
        };
    }

    let rows = query
        .order((
            recurring_transactions::updated_at.desc(),
            recurring_transactions::id.desc(),
        ))
        .limit(MAX_BULK_SELECTION as i64 + 1)
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
