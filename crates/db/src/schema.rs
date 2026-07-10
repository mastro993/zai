// @generated automatically by Diesel CLI.

diesel::table! {
    transaction_categories (id) {
        id -> Text,
        parent_id -> Nullable<Text>,
        name -> Text,
        description -> Nullable<Text>,
        color -> Nullable<Text>,
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

diesel::table! {
    budgets (id) {
        id -> Text,
        name -> Text,
        cadence -> Text,
        first_period_start -> Date,
        deactivated_at -> Nullable<Timestamp>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    budget_revisions (id) {
        id -> Text,
        budget_id -> Text,
        effective_period_start -> Date,
        allowance -> Integer,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    budget_revision_scopes (revision_id, category_id) {
        revision_id -> Text,
        category_id -> Text,
    }
}

diesel::joinable!(transactions -> transaction_categories (transaction_category_id));
diesel::joinable!(budget_revisions -> budgets (budget_id));
diesel::joinable!(budget_revision_scopes -> budget_revisions (revision_id));
diesel::joinable!(budget_revision_scopes -> transaction_categories (category_id));

diesel::allow_tables_to_appear_in_same_query!(
    transaction_categories,
    transactions,
    budgets,
    budget_revisions,
    budget_revision_scopes,
);
