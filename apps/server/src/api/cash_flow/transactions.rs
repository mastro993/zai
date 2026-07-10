use std::sync::Arc;

use axum::{
    Json, Router,
    extract::rejection::JsonRejection,
    extract::{FromRequest, Path, Query, Request, State},
    http::StatusCode,
    routing::{get, post},
};
use chrono::NaiveDateTime;
use serde::Deserialize;
use zai_app::ServiceContext;
use zai_core::features::transaction_categories::models::NewTransactionCategory;
use zai_core::features::transactions::models::{
    NewTransaction, Transaction, TransactionSearchFilters, TransactionUpdate,
};
use zai_core::query::{PaginatedData, Sort};

use crate::api::error::{bad_request, command_error};

fn default_page() -> i64 {
    1
}

fn default_per_page() -> i64 {
    50
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(&input[index + 1..index + 3], 16) {
                out.push(byte);
                index += 3;
                continue;
            }
        }

        out.push(bytes[index]);
        index += 1;
    }

    String::from_utf8(out).unwrap_or_else(|_| input.to_string())
}

fn category_ids_from_query(query: &str) -> Vec<String> {
    query
        .split('&')
        .filter_map(|segment| {
            let (key, value) = segment.split_once('=')?;
            if key == "categoryId" {
                Some(percent_decode(value))
            } else {
                None
            }
        })
        .collect()
}

fn query_without_category_ids(query: &str) -> String {
    query
        .split('&')
        .filter(|segment| !segment.starts_with("categoryId="))
        .collect::<Vec<_>>()
        .join("&")
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListTransactionsQueryBase {
    #[serde(default = "default_page")]
    page: i64,
    #[serde(default = "default_per_page")]
    per_page: i64,
    query: Option<String>,
    transaction_type: Option<String>,
    start_date: Option<NaiveDateTime>,
    end_date: Option<NaiveDateTime>,
    uncategorized: Option<String>,
    sort_field: Option<String>,
    sort_desc: Option<bool>,
}

#[derive(Debug)]
struct ListTransactionsQuery {
    page: i64,
    per_page: i64,
    query: Option<String>,
    transaction_type: Option<String>,
    start_date: Option<NaiveDateTime>,
    end_date: Option<NaiveDateTime>,
    category_ids: Vec<String>,
    uncategorized: Option<String>,
    sort_field: Option<String>,
    sort_desc: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransactionPayload {
    #[serde(default)]
    id: Option<String>,
    description: Option<String>,
    amount: i32,
    transaction_date: NaiveDateTime,
    transaction_type: String,
    transaction_category_id: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BulkDeleteBody {
    transaction_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportTransactionsBody {
    transactions: Vec<NewTransaction>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportBatchBody {
    categories: Vec<NewTransactionCategory>,
    transactions: Vec<NewTransaction>,
}

type TransactionResult<T> = Result<T, (StatusCode, Json<crate::api::error::ApiError>)>;

fn is_uncategorized(value: &Option<String>) -> bool {
    value.as_deref() == Some("true")
}

fn list_query_to_filters(
    query: &ListTransactionsQuery,
) -> Result<Option<TransactionSearchFilters<'_>>, (StatusCode, Json<crate::api::error::ApiError>)> {
    let uncategorized = is_uncategorized(&query.uncategorized);

    if uncategorized && !query.category_ids.is_empty() {
        return Err(bad_request(
            "Choose either category filters or uncategorized only",
        ));
    }

    let has_filter = query.query.is_some()
        || query.transaction_type.is_some()
        || query.start_date.is_some()
        || query.end_date.is_some()
        || uncategorized
        || !query.category_ids.is_empty();

    if !has_filter {
        return Ok(None);
    }

    let categories = if uncategorized {
        Some(Vec::new())
    } else if query.category_ids.is_empty() {
        None
    } else {
        Some(
            query
                .category_ids
                .iter()
                .map(String::as_str)
                .collect::<Vec<_>>(),
        )
    };

    Ok(Some(TransactionSearchFilters {
        query: query.query.as_deref(),
        categories,
        transaction_type: query.transaction_type.as_deref(),
        start_date: query.start_date,
        end_date: query.end_date,
    }))
}

fn list_query_to_sort(query: &ListTransactionsQuery) -> Option<Sort> {
    query.sort_field.as_ref().map(|field| Sort {
        field: field.clone(),
        desc: query.sort_desc.unwrap_or(false),
    })
}

fn parse_json<T>(result: Result<Json<T>, JsonRejection>) -> TransactionResult<Json<T>>
where
    T: serde::de::DeserializeOwned,
{
    result.map_err(|rejection| bad_request(rejection.body_text()))
}

struct ValidatedListQuery(ListTransactionsQuery);

impl<S> FromRequest<S> for ValidatedListQuery
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<crate::api::error::ApiError>);

    async fn from_request(mut req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let query_string = req.uri().query().unwrap_or("");
        let category_ids = category_ids_from_query(query_string);
        let filtered_query = query_without_category_ids(query_string);
        let path = req.uri().path();
        let request_uri = if filtered_query.is_empty() {
            path.to_string()
        } else {
            format!("{path}?{filtered_query}")
        };

        *req.uri_mut() = request_uri
            .parse()
            .map_err(|error: axum::http::uri::InvalidUri| bad_request(error.to_string()))?;

        let Query(base) = Query::<ListTransactionsQueryBase>::from_request(req, state)
            .await
            .map_err(|rejection| bad_request(rejection.to_string()))?;

        Ok(Self(ListTransactionsQuery {
            page: base.page,
            per_page: base.per_page,
            query: base.query,
            transaction_type: base.transaction_type,
            start_date: base.start_date,
            end_date: base.end_date,
            category_ids,
            uncategorized: base.uncategorized,
            sort_field: base.sort_field,
            sort_desc: base.sort_desc,
        }))
    }
}

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new()
        .route("/", get(list_transactions).post(create_transaction))
        .route("/bulk-delete", post(bulk_delete_transactions))
        .route("/import", post(import_transactions))
        .route("/import-batch", post(import_transaction_batch))
        .route(
            "/{transaction_id}",
            get(get_transaction)
                .put(update_transaction)
                .delete(delete_transaction),
        )
}

async fn list_transactions(
    State(context): State<Arc<ServiceContext>>,
    ValidatedListQuery(query): ValidatedListQuery,
) -> TransactionResult<Json<PaginatedData<Transaction>>> {
    let filters = list_query_to_filters(&query)?;
    let sort = list_query_to_sort(&query);

    context
        .transactions_service()
        .get_transactions(query.page, query.per_page, filters, sort)
        .map(Json)
        .map_err(|error| command_error("Failed to load transactions", error))
}

async fn get_transaction(
    State(context): State<Arc<ServiceContext>>,
    Path(transaction_id): Path<String>,
) -> TransactionResult<Json<Transaction>> {
    context
        .transactions_service()
        .get_transaction(&transaction_id)
        .map(Json)
        .map_err(|error| command_error("Failed to load transaction", error))
}

async fn create_transaction(
    State(context): State<Arc<ServiceContext>>,
    body: Result<Json<TransactionPayload>, JsonRejection>,
) -> TransactionResult<(StatusCode, Json<Transaction>)> {
    let Json(payload) = parse_json(body)?;
    let new_transaction = NewTransaction {
        id: payload.id,
        description: payload.description,
        amount: payload.amount,
        transaction_date: payload.transaction_date,
        transaction_type: payload.transaction_type,
        transaction_category_id: payload.transaction_category_id,
        notes: payload.notes,
    };

    context
        .transactions_service()
        .create_transaction(new_transaction)
        .await
        .map(|transaction| (StatusCode::CREATED, Json(transaction)))
        .map_err(|error| command_error("Failed to create transaction", error))
}

async fn update_transaction(
    State(context): State<Arc<ServiceContext>>,
    Path(transaction_id): Path<String>,
    body: Result<Json<TransactionPayload>, JsonRejection>,
) -> TransactionResult<Json<Transaction>> {
    let Json(payload) = parse_json(body)?;
    let update = TransactionUpdate {
        id: transaction_id,
        description: payload.description,
        amount: payload.amount,
        transaction_date: payload.transaction_date,
        transaction_type: payload.transaction_type,
        transaction_category_id: payload.transaction_category_id,
        notes: payload.notes,
    };

    context
        .transactions_service()
        .update_transaction(update)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to update transaction", error))
}

async fn delete_transaction(
    State(context): State<Arc<ServiceContext>>,
    Path(transaction_id): Path<String>,
) -> TransactionResult<Json<Transaction>> {
    context
        .transactions_service()
        .delete_transaction(&transaction_id)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to delete transaction", error))
}

async fn bulk_delete_transactions(
    State(context): State<Arc<ServiceContext>>,
    body: Result<Json<BulkDeleteBody>, JsonRejection>,
) -> TransactionResult<Json<Vec<Transaction>>> {
    let Json(payload) = parse_json(body)?;
    let transaction_id_refs = payload.transaction_ids.iter().map(String::as_str).collect();

    context
        .transactions_service()
        .delete_transactions(transaction_id_refs)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to delete transactions", error))
}

async fn import_transactions(
    State(context): State<Arc<ServiceContext>>,
    body: Result<Json<ImportTransactionsBody>, JsonRejection>,
) -> TransactionResult<Json<Vec<Transaction>>> {
    let Json(payload) = parse_json(body)?;

    context
        .transactions_service()
        .import_transactions(payload.transactions)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to import transactions", error))
}

async fn import_transaction_batch(
    State(context): State<Arc<ServiceContext>>,
    body: Result<Json<ImportBatchBody>, JsonRejection>,
) -> TransactionResult<Json<Vec<Transaction>>> {
    let Json(payload) = parse_json(body)?;

    context
        .transactions_service()
        .import_transactions_with_categories(payload.categories, payload.transactions)
        .await
        .map(|(_, transactions)| Json(transactions))
        .map_err(|error| command_error("Failed to import transaction batch", error))
}
