use super::*;
use crate::schema::{
    recurring_occurrence_heads, recurring_occurrences, recurring_schedule_revisions,
    recurring_template_revisions, recurring_transactions, transactions,
};
use chrono::{NaiveDate, NaiveDateTime, Utc};
use zai_core::features::transaction_categories::traits::TransactionCategoriesRepositoryTrait;

async fn seed_recurring_template(repo: &TransactionCategoriesRepository, category_id: &str) {
    let now = Utc::now().naive_utc();
    let scheduled = NaiveDate::from_ymd_opt(2026, 8, 1)
        .unwrap()
        .and_hms_opt(9, 0, 0)
        .unwrap();
    let recurring_id = "recurring-category-impact".to_string();
    let schedule_id = "recurring-category-impact-schedule".to_string();
    let template_id = "recurring-category-impact-template".to_string();
    let category_id = category_id.to_string();

    repo.writer
        .exec(move |conn| {
            diesel::insert_into(recurring_transactions::table)
                .values((
                    recurring_transactions::id.eq(&recurring_id),
                    recurring_transactions::lifecycle.eq("active"),
                    recurring_transactions::total_occurrences.eq(None::<i32>),
                    recurring_transactions::fulfilled_count.eq(0),
                    recurring_transactions::revision.eq(1),
                    recurring_transactions::lifecycle_changed_at.eq(now),
                    recurring_transactions::paused_at.eq(None::<NaiveDateTime>),
                    recurring_transactions::created_at.eq(now),
                    recurring_transactions::updated_at.eq(now),
                    recurring_transactions::deleted_at.eq(None::<NaiveDateTime>),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            diesel::insert_into(recurring_schedule_revisions::table)
                .values((
                    recurring_schedule_revisions::id.eq(&schedule_id),
                    recurring_schedule_revisions::recurring_transaction_id.eq(&recurring_id),
                    recurring_schedule_revisions::sequence.eq(1),
                    recurring_schedule_revisions::effective_from_local.eq(scheduled),
                    recurring_schedule_revisions::effective_until_local.eq(None::<NaiveDateTime>),
                    recurring_schedule_revisions::first_scheduled_local.eq(scheduled),
                    recurring_schedule_revisions::interval_every.eq(Some(1)),
                    recurring_schedule_revisions::interval_unit.eq(Some("month".to_string())),
                    recurring_schedule_revisions::monthly_day.eq(None::<i32>),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            diesel::insert_into(recurring_template_revisions::table)
                .values((
                    recurring_template_revisions::id.eq(&template_id),
                    recurring_template_revisions::recurring_transaction_id.eq(&recurring_id),
                    recurring_template_revisions::sequence.eq(1),
                    recurring_template_revisions::effective_from_local.eq(scheduled),
                    recurring_template_revisions::effective_until_local.eq(None::<NaiveDateTime>),
                    recurring_template_revisions::description.eq("Rent"),
                    recurring_template_revisions::amount.eq(100),
                    recurring_template_revisions::transaction_type.eq("expense"),
                    recurring_template_revisions::transaction_category_id.eq(Some(category_id)),
                    recurring_template_revisions::notes.eq(None::<String>),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            diesel::insert_into(recurring_occurrence_heads::table)
                .values((
                    recurring_occurrence_heads::recurring_transaction_id.eq(&recurring_id),
                    recurring_occurrence_heads::schedule_revision_id.eq(&schedule_id),
                    recurring_occurrence_heads::next_ordinal.eq(1),
                    recurring_occurrence_heads::next_scheduled_local.eq(scheduled),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("recurring source");
}

#[tokio::test]
async fn preview_delete_reports_visible_recurring_sources_with_unfulfilled_templates() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let category = repo
        .create_category(NewTransactionCategory {
            name: "Rent".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some("rent-category".to_string()),
        })
        .await
        .unwrap();
    seed_recurring_template(&repo, &category.id).await;

    let preview = repo
        .preview_delete_categories(
            vec![category.id.as_str()],
            CategoryChildrenDeleteStrategy::Block,
        )
        .await
        .expect("preview");

    assert_eq!(preview.affected_recurring_transactions.len(), 1);
    assert_eq!(
        preview.affected_recurring_transactions[0].recurring_transaction_id,
        "recurring-category-impact"
    );
    assert_eq!(
        preview.affected_recurring_transactions[0].description,
        "Rent"
    );
}

#[tokio::test]
async fn delete_preserves_fulfilled_recurring_snapshot_and_splits_future_template() {
    let temp_db = TempDb::new();
    let repo = setup_test_repo(temp_db.path());
    let category = repo
        .create_category(NewTransactionCategory {
            name: "Rent".to_string(),
            parent_id: None,
            description: None,
            color: None,
            role: None,
            id: Some("rent-category-history".to_string()),
        })
        .await
        .unwrap();
    seed_recurring_template(&repo, &category.id).await;

    let now = Utc::now().naive_utc();
    let fulfilled = NaiveDate::from_ymd_opt(2026, 8, 1)
        .unwrap()
        .and_hms_opt(9, 0, 0)
        .unwrap();
    let next = NaiveDate::from_ymd_opt(2026, 9, 1)
        .unwrap()
        .and_hms_opt(9, 0, 0)
        .unwrap();
    let category_id = category.id.clone();
    repo.writer
        .exec(move |conn| {
            diesel::update(
                recurring_transactions::table
                    .filter(recurring_transactions::id.eq("recurring-category-impact")),
            )
            .set(recurring_transactions::fulfilled_count.eq(1))
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            diesel::update(
                recurring_occurrence_heads::table.filter(
                    recurring_occurrence_heads::recurring_transaction_id
                        .eq("recurring-category-impact"),
                ),
            )
            .set((
                recurring_occurrence_heads::next_ordinal.eq(2),
                recurring_occurrence_heads::next_scheduled_local.eq(next),
            ))
            .execute(conn)
            .map_err(crate::errors::StorageError::from)?;
            diesel::insert_into(transactions::table)
                .values((
                    transactions::id.eq("recurring-history-transaction"),
                    transactions::description.eq(Some("Rent".to_string())),
                    transactions::amount.eq(100),
                    transactions::transaction_date.eq(fulfilled),
                    transactions::transaction_type.eq("expense"),
                    transactions::transaction_category_id.eq(Some(category_id)),
                    transactions::notes.eq(None::<String>),
                    transactions::created_at.eq(now),
                    transactions::updated_at.eq(now),
                    transactions::deleted_at.eq(None::<NaiveDateTime>),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            diesel::insert_into(recurring_occurrences::table)
                .values((
                    recurring_occurrences::recurring_transaction_id.eq("recurring-category-impact"),
                    recurring_occurrences::schedule_revision_id
                        .eq("recurring-category-impact-schedule"),
                    recurring_occurrences::ordinal.eq(1),
                    recurring_occurrences::scheduled_local.eq(fulfilled),
                    recurring_occurrences::template_revision_id
                        .eq("recurring-category-impact-template"),
                    recurring_occurrences::fulfilled_at.eq(now),
                    recurring_occurrences::fulfillment_position.eq(1),
                    recurring_occurrences::transaction_id.eq("recurring-history-transaction"),
                    recurring_occurrences::fulfillment_kind.eq("adopted"),
                    recurring_occurrences::recurring_alert_id.eq(None::<String>),
                ))
                .execute(conn)
                .map_err(crate::errors::StorageError::from)?;
            Ok(())
        })
        .await
        .expect("fulfilled recurring source");

    repo.delete_categories(
        vec![category.id.as_str()],
        CategoryChildrenDeleteStrategy::Block,
        false,
    )
    .await
    .expect("delete");

    let conn = &mut get_connection(&repo.pool).unwrap();
    let template_rows = recurring_template_revisions::table
        .filter(
            recurring_template_revisions::recurring_transaction_id.eq("recurring-category-impact"),
        )
        .order(recurring_template_revisions::effective_from_local.asc())
        .select((
            recurring_template_revisions::effective_from_local,
            recurring_template_revisions::effective_until_local,
            recurring_template_revisions::transaction_category_id,
        ))
        .load::<(NaiveDateTime, Option<NaiveDateTime>, Option<String>)>(conn)
        .unwrap();
    assert_eq!(template_rows.len(), 2);
    assert_eq!(template_rows[0].0, fulfilled);
    assert_eq!(template_rows[0].1, Some(next));
    assert_eq!(template_rows[0].2.as_deref(), Some(category.id.as_str()));
    assert_eq!(template_rows[1].0, next);
    assert!(template_rows[1].1.is_none());
    assert!(template_rows[1].2.is_none());

    let snapshot_category = transactions::table
        .filter(transactions::id.eq("recurring-history-transaction"))
        .select(transactions::transaction_category_id)
        .first::<Option<String>>(conn)
        .unwrap();
    assert_eq!(snapshot_category.as_deref(), Some(category.id.as_str()));
}
