// @generated automatically by Diesel CLI.

diesel::table! {
    transaction (id) {
        id -> Text,
        date -> Timestamp,
        kind -> Text,
        category_id -> Nullable<Text>,
        amount -> Double,
        description -> Text,
        notes -> Nullable<Text>,
        created_at -> Nullable<Timestamp>,
        updated_at -> Nullable<Timestamp>,
        deleted_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    transaction_category (id) {
        id -> Text,
        parent_id -> Nullable<Text>,
        name -> Text,
        description -> Nullable<Text>,
        color -> Nullable<Text>,
        created_at -> Nullable<Timestamp>,
        updated_at -> Nullable<Timestamp>,
        deleted_at -> Nullable<Timestamp>,
    }
}

diesel::joinable!(transaction -> transaction_category (category_id));

diesel::allow_tables_to_appear_in_same_query!(
    transaction,
    transaction_category,
);
