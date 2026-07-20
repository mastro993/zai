// @generated automatically by Diesel CLI.

diesel::table! {
    transaction_categories (id) {
        id -> Text,
        parent_id -> Nullable<Text>,
        name -> Text,
        description -> Nullable<Text>,
        color -> Nullable<Text>,
        role -> Text,
        created_at -> Timestamp,
        updated_at -> Timestamp,
        deleted_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    transactions (id) {
        id -> Text,
        description -> Nullable<Text>,
        amount -> Integer,
        transaction_date -> Timestamp,
        transaction_type -> Text,
        transaction_category_id -> Nullable<Text>,
        notes -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
        deleted_at -> Nullable<Timestamp>,
    }
}

diesel::joinable!(transactions -> transaction_categories (transaction_category_id));

diesel::table! {
    budget_configurations (budget_id, period_start) {
        budget_id -> Text,
        period_start -> Timestamp,
        period_end -> Timestamp,
        category_ids -> Text,
        base_allowance -> BigInt,
        measurement_mode -> Text,
        rollover_mode -> Text,
        warning_percentage -> Nullable<Integer>,
    }
}

diesel::table! {
    budget_period_results (budget_id, period_start) {
        budget_id -> Text,
        period_start -> Timestamp,
        period_end -> Timestamp,
        net_budget_spending -> BigInt,
        effective_allowance -> BigInt,
        remaining_allowance -> BigInt,
        status -> Text,
    }
}

diesel::table! {
    budgets (id) {
        id -> Text,
        name -> Text,
        cadence -> Text,
        measurement_mode -> Text,
        base_allowance -> BigInt,
        rollover_mode -> Text,
        warning_percentage -> Nullable<Integer>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
        deleted_at -> Nullable<Timestamp>,
        revision -> BigInt,
        paused -> Bool,
    }
}

diesel::joinable!(budget_configurations -> budgets (budget_id));
diesel::joinable!(budget_period_results -> budgets (budget_id));

diesel::table! {
    domain_alerts (id) {
        id -> Text,
        producer_key -> Text,
        occurrence_key -> Text,
        severity -> Text,
        title -> Text,
        body -> Text,
        destination -> Nullable<Text>,
        data -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
        read_at -> Nullable<Timestamp>,
        resolved_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    recurring_transactions (id) {
        id -> Text,
        name -> Text,
        lifecycle -> Text,
        total_occurrences -> Nullable<Integer>,
        fulfilled_count -> Integer,
        revision -> Integer,
        lifecycle_changed_at -> Timestamp,
        paused_at -> Nullable<Timestamp>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
        deleted_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    recurring_schedule_revisions (id) {
        id -> Text,
        recurring_transaction_id -> Text,
        sequence -> Integer,
        effective_from_local -> Timestamp,
        effective_until_local -> Nullable<Timestamp>,
        first_scheduled_local -> Timestamp,
        interval_every -> Nullable<Integer>,
        interval_unit -> Nullable<Text>,
        monthly_day -> Nullable<Integer>,
    }
}

diesel::table! {
    recurring_template_revisions (id) {
        id -> Text,
        recurring_transaction_id -> Text,
        sequence -> Integer,
        effective_from_local -> Timestamp,
        effective_until_local -> Nullable<Timestamp>,
        description -> Nullable<Text>,
        amount -> Integer,
        transaction_type -> Text,
        transaction_category_id -> Nullable<Text>,
        notes -> Nullable<Text>,
    }
}

diesel::table! {
    recurring_occurrence_heads (recurring_transaction_id) {
        recurring_transaction_id -> Text,
        schedule_revision_id -> Text,
        next_ordinal -> Integer,
        next_scheduled_local -> Timestamp,
    }
}

diesel::table! {
    recurring_occurrences (recurring_transaction_id, schedule_revision_id, ordinal) {
        recurring_transaction_id -> Text,
        schedule_revision_id -> Text,
        ordinal -> Integer,
        scheduled_local -> Timestamp,
        template_revision_id -> Text,
        fulfilled_at -> Timestamp,
        fulfillment_position -> Integer,
        transaction_id -> Text,
        fulfillment_kind -> Text,
        recurring_alert_id -> Nullable<Text>,
    }
}

diesel::table! {
    recurring_generation_failures (recurring_transaction_id, schedule_revision_id, ordinal) {
        recurring_transaction_id -> Text,
        schedule_revision_id -> Text,
        ordinal -> Integer,
        error_code -> Text,
        cause_category -> Text,
        repair_field_key -> Nullable<Text>,
        correlation_id -> Text,
        failed_scheduled_local -> Timestamp,
        first_failed_at -> Timestamp,
        last_failed_at -> Timestamp,
        attempt_count -> Integer,
        repaired_at -> Nullable<Timestamp>,
        repair_revision -> Nullable<Integer>,
        resolved_at -> Nullable<Timestamp>,
        resolution_kind -> Nullable<Text>,
        generation_failure_alert_id -> Text,
    }
}

diesel::joinable!(recurring_schedule_revisions -> recurring_transactions (recurring_transaction_id));
diesel::joinable!(recurring_template_revisions -> recurring_transactions (recurring_transaction_id));
diesel::joinable!(recurring_occurrence_heads -> recurring_transactions (recurring_transaction_id));
diesel::joinable!(recurring_occurrence_heads -> recurring_schedule_revisions (schedule_revision_id));
diesel::joinable!(recurring_occurrences -> recurring_transactions (recurring_transaction_id));
diesel::joinable!(recurring_occurrences -> recurring_schedule_revisions (schedule_revision_id));
diesel::joinable!(recurring_occurrences -> recurring_template_revisions (template_revision_id));
diesel::joinable!(recurring_occurrences -> transactions (transaction_id));
diesel::joinable!(recurring_occurrences -> domain_alerts (recurring_alert_id));
diesel::joinable!(recurring_generation_failures -> recurring_transactions (recurring_transaction_id));
diesel::joinable!(recurring_generation_failures -> recurring_schedule_revisions (schedule_revision_id));
diesel::joinable!(recurring_generation_failures -> domain_alerts (generation_failure_alert_id));
diesel::joinable!(recurring_template_revisions -> transaction_categories (transaction_category_id));

diesel::allow_tables_to_appear_in_same_query!(
    transaction_categories,
    transactions,
    budget_configurations,
    budget_period_results,
    budgets,
    domain_alerts,
    recurring_transactions,
    recurring_schedule_revisions,
    recurring_template_revisions,
    recurring_occurrence_heads,
    recurring_occurrences,
    recurring_generation_failures,
);
