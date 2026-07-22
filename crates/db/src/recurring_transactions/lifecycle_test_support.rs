use super::process_test_support::local;
use super::seed::SeedRecurringSource;
use zai_core::features::recurring_transactions::{
    RecurringLifecycleUpdate, RecurringTemplateInput, RecurringTransactionDocument,
    UpdateRecurringTransaction,
};

pub fn base_seed(id: &str, description: &str) -> SeedRecurringSource {
    SeedRecurringSource {
        id: id.into(),
        description: description.into(),
        lifecycle: "active",
        total_occurrences: Some(12),
        fulfilled_count: 0,
        revision: 1,
        first_scheduled_local: local(2026, 1, 1, 9, 0),
        next_scheduled_local: local(2026, 1, 1, 9, 0),
        next_ordinal: 1,
        amount: 1000,
        transaction_type: "expense",
    }
}

pub fn lifecycle_update(id: &str, revision: i32) -> RecurringLifecycleUpdate {
    RecurringLifecycleUpdate {
        recurring_transaction_id: id.into(),
        expected_revision: revision,
    }
}

pub fn update_from_document(document: &RecurringTransactionDocument) -> UpdateRecurringTransaction {
    UpdateRecurringTransaction {
        recurring_transaction_id: document.recurring_transaction.id.clone(),
        expected_revision: document.recurring_transaction.revision,
        schedule: document.schedule.rule.clone(),
        next_scheduled_local: document
            .occurrence_summary
            .next_scheduled_local
            .unwrap_or(document.schedule.first_scheduled_local),
        total_occurrences: document.recurring_transaction.total_occurrences,
        template: RecurringTemplateInput {
            description: document.template.description.clone(),
            amount: document.template.amount,
            transaction_type: document.template.transaction_type.clone(),
            transaction_category_id: document.template.transaction_category_id.clone(),
            notes: document.template.notes.clone(),
        },
    }
}
