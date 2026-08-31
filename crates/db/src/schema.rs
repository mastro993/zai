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
        icon -> Nullable<Text>,
    }
}

diesel::table! {
    transactions (id) {
        id -> Text,
        description -> Nullable<Text>,
        amount -> BigInt,
        currency -> Text,
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
        allowance_currency -> Text,
    }
}

diesel::table! {
    budget_period_results (budget_id, period_start) {
        budget_id -> Text,
        period_start -> Timestamp,
        period_end -> Timestamp,
        net_budget_spending -> BigInt,
        effective_allowance -> Nullable<BigInt>,
        remaining_allowance -> Nullable<BigInt>,
        status -> Nullable<Text>,
        generation_id -> Text,
        complete -> Bool,
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
        description -> Text,
        amount -> BigInt,
        currency -> Text,
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

diesel::table! {
    application_format (id) {
        id -> Integer,
        format -> Text,
        activated_at -> Timestamp,
    }
}

diesel::table! {
    currency_settings (id) {
        id -> Integer,
        default_currency -> Text,
        setup_completed_at -> Nullable<Timestamp>,
        default_currency_revision -> Integer,
        provider_disclosure_accepted_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    enabled_currencies (code) {
        code -> Text,
        enabled_at -> Timestamp,
        disabled_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    currency_jobs (id) {
        id -> Text,
        job_type -> Text,
        status -> Text,
        currency_code -> Nullable<Text>,
        stage_current -> Integer,
        stage_total -> Integer,
        error_code -> Nullable<Text>,
        error_message -> Nullable<Text>,
        generation_id -> Nullable<Text>,
        error_details -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    transaction_exchange_rate_revisions (id) {
        id -> Text,
        transaction_id -> Text,
        sequence -> Integer,
        variant -> Text,
        rate_date -> Nullable<Timestamp>,
        original_decimal -> Nullable<Text>,
        coefficient -> Nullable<BigInt>,
        scale -> Nullable<Integer>,
        formula_version -> Integer,
        created_at -> Timestamp,
    }
}

diesel::joinable!(transaction_exchange_rate_revisions -> transactions (transaction_id));

diesel::table! {
    provider_contracts (id) {
        id -> Text,
        provider -> Text,
        version -> Integer,
        base_currency -> Text,
        series_identity -> Text,
        value_date_time_zone -> Text,
        formula_version -> Integer,
        created_at -> Timestamp,
    }
}

diesel::table! {
    provider_rate_sets (id) {
        id -> Text,
        provider_contract_id -> Text,
        revision_identity -> Text,
        payload_digest -> Text,
        accepted_at -> Timestamp,
    }
}

diesel::table! {
    provider_rate_observations (id) {
        id -> Text,
        rate_set_id -> Text,
        currency -> Text,
        series_id -> Text,
        value_date -> Text,
        original_decimal -> Text,
        coefficient -> BigInt,
        scale -> Integer,
        attribution -> Text,
    }
}

diesel::table! {
    provider_heads (id) {
        id -> Integer,
        rate_set_id -> Text,
        switched_at -> Timestamp,
    }
}

diesel::table! {
    provider_refresh_state (id) {
        id -> Integer,
        provider_contract_id -> Text,
        last_attempt_at -> Nullable<Timestamp>,
        last_success_at -> Nullable<Timestamp>,
        failure_class -> Nullable<Text>,
        retry_count -> Integer,
        last_etag -> Nullable<Text>,
        last_updated_after -> Nullable<Text>,
    }
}

diesel::joinable!(provider_rate_sets -> provider_contracts (provider_contract_id));
diesel::joinable!(provider_rate_observations -> provider_rate_sets (rate_set_id));
diesel::joinable!(provider_heads -> provider_rate_sets (rate_set_id));
diesel::joinable!(provider_refresh_state -> provider_contracts (provider_contract_id));

diesel::table! {
    valuation_generations (id) {
        id -> Text,
        kind -> Text,
        target_currency -> Text,
        prior_currency -> Nullable<Text>,
        default_currency_revision -> Integer,
        status -> Text,
        created_at -> Timestamp,
        activated_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    valuation_heads (kind) {
        kind -> Text,
        generation_id -> Text,
        switched_at -> Timestamp,
    }
}

diesel::table! {
    transaction_valuations (generation_id, transaction_id) {
        generation_id -> Text,
        transaction_id -> Text,
        transaction_date -> Timestamp,
        converted_amount -> Nullable<BigInt>,
        converted_currency -> Text,
        complete -> Bool,
        rate_revision_id -> Nullable<Text>,
    }
}

diesel::joinable!(valuation_heads -> valuation_generations (generation_id));
diesel::joinable!(transaction_valuations -> valuation_generations (generation_id));
diesel::joinable!(transaction_valuations -> transactions (transaction_id));
diesel::joinable!(budget_period_results -> valuation_generations (generation_id));

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
    application_format,
    currency_settings,
    enabled_currencies,
    currency_jobs,
    transaction_exchange_rate_revisions,
    provider_contracts,
    provider_rate_sets,
    provider_rate_observations,
    provider_heads,
    provider_refresh_state,
    valuation_generations,
    valuation_heads,
    transaction_valuations,
);
