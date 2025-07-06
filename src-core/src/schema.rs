// @generated automatically by Diesel CLI.

diesel::table! {
    transaction (id) {
        id -> Integer,
        description -> Text,
        amount -> Integer,
        date -> Date,
        #[sql_name = "type"]
        type_ -> Text,
        category_id -> Nullable<Integer>,
        notes -> Nullable<Text>,
        created_at -> Nullable<Timestamp>,
        updated_at -> Nullable<Timestamp>,
        deleted_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    transaction_category (id) {
        id -> Integer,
        parent_id -> Nullable<Integer>,
        name -> Text,
        color -> Nullable<Text>,
        description -> Nullable<Text>,
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
