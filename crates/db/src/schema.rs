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
        read_at -> Nullable<Timestamp>,
    }
}

diesel::allow_tables_to_appear_in_same_query!(
    transaction_categories,
    transactions,
    budget_configurations,
    budget_period_results,
    budgets,
    domain_alerts,
);
