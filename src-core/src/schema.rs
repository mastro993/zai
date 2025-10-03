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
        date -> Timestamp,
        transaction_type -> Text,
        transaction_category_id -> Nullable<Text>,
        notes -> Nullable<Text>,
        created_at -> Timestamp,
        updated_at -> Timestamp,
        deleted_at -> Nullable<Timestamp>,
    }
}

diesel::joinable!(transactions -> transaction_categories (transaction_category_id));

diesel::allow_tables_to_appear_in_same_query!(transaction_categories, transactions,);
