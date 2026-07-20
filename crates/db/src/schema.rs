// Hand-maintained since the recurring MVP code migration (v1) owns the DDL.

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
        time_zone -> Text,
    }
}

diesel::joinable!(transactions -> transaction_categories (transaction_category_id));

diesel::table! {
    budget_configurations (budget_id, period_start) {
        budget_id -> Text,
        period_start -> Date,
        period_end -> Date,
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
        period_start -> Date,
        period_end -> Date,
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
        time_zone -> Text,
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
        read_at -> Nullable<Timestamp>,
        updated_at -> Timestamp,
        resolved_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    recurring_transactions (id) {
        id -> Text,
        name -> Text,
        lifecycle -> Text,
        finite_count -> Nullable<Integer>,
        fulfilled_count -> Integer,
        revision -> Integer,
        created_at -> Timestamp,
        updated_at -> Timestamp,
        paused_at -> Nullable<Timestamp>,
        stopped_at -> Nullable<Timestamp>,
        completed_at -> Nullable<Timestamp>,
        tombstoned_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    recurring_schedule_revisions (id) {
        id -> Text,
        recurring_transaction_id -> Text,
        effective_from_utc -> Timestamp,
        effective_until_utc -> Nullable<Timestamp>,
        recurrence_kind -> Text,
        interval_unit -> Nullable<Text>,
        interval_count -> Nullable<Integer>,
        monthly_day -> Nullable<Integer>,
        zone -> Text,
        anchor_local_date -> Text,
        anchor_local_time -> Text,
    }
}

diesel::table! {
    recurring_template_revisions (id) {
        id -> Text,
        recurring_transaction_id -> Text,
        effective_from_utc -> Timestamp,
        effective_until_utc -> Nullable<Timestamp>,
        amount -> Integer,
        transaction_type -> Text,
        transaction_category_id -> Nullable<Text>,
        description -> Nullable<Text>,
        notes -> Nullable<Text>,
    }
}

diesel::table! {
    recurring_occurrence_heads (recurring_transaction_id) {
        recurring_transaction_id -> Text,
        schedule_revision_id -> Text,
        ordinal -> Integer,
        due_at_utc -> Timestamp,
    }
}

diesel::table! {
    recurring_occurrences (recurring_transaction_id, schedule_revision_id, ordinal) {
        recurring_transaction_id -> Text,
        schedule_revision_id -> Text,
        ordinal -> Integer,
        template_revision_id -> Text,
        intended_local_date -> Text,
        intended_local_time -> Text,
        zone -> Text,
        resolved_at_utc -> Timestamp,
        kind -> Text,
        fulfilled_at -> Nullable<Timestamp>,
        fulfillment_position -> Nullable<Integer>,
        transaction_id -> Nullable<Text>,
        alert_id -> Nullable<Text>,
    }
}

diesel::table! {
    recurring_generation_failures (recurring_transaction_id, schedule_revision_id, ordinal) {
        recurring_transaction_id -> Text,
        schedule_revision_id -> Text,
        ordinal -> Integer,
        correlation_id -> Text,
        redacted_error_code -> Text,
        redacted_error_message -> Text,
        failed_intended_local_date -> Text,
        failed_intended_local_time -> Text,
        failed_zone -> Text,
        failed_resolved_at_utc -> Nullable<Timestamp>,
        attempt_count -> Integer,
        created_at -> Timestamp,
        updated_at -> Timestamp,
        repair_metadata -> Nullable<Text>,
        resolution_metadata -> Nullable<Text>,
        resolved_at -> Nullable<Timestamp>,
        failure_alert_id -> Nullable<Text>,
    }
}

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
