use std::sync::Arc;

use axum::{
    Json, Router,
    extract::rejection::{JsonRejection, QueryRejection},
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
};
use serde::Deserialize;
use zai_app::ServiceContext;
use zai_core::features::transaction_categories::models::{
    CategoryChildrenDeleteStrategy, CategoryRole, NewTransactionCategory, TransactionCategory,
    TransactionCategoryUpdate,
};

use crate::api::error::{bad_request, command_error};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCategoriesQuery {
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkDeleteCategoriesRequest {
    pub category_ids: Vec<String>,
    pub children_strategy: Option<CategoryChildrenDeleteStrategy>,
    #[serde(default)]
    pub confirm_budget_impact: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryRequest {
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub role: Option<CategoryRole>,
    #[serde(default)]
    pub confirm_budget_impact: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCategoriesRequest {
    pub categories: Vec<NewTransactionCategory>,
}

type CategoryResult<T> = Result<T, (StatusCode, Json<crate::api::error::ApiError>)>;

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new()
        .route("/categories", get(list_categories).post(create_category))
        .route("/categories/bulk-delete", post(bulk_delete_categories))
        .route("/categories/import", post(import_categories))
        .route(
            "/categories/{category_id}",
            get(get_category).put(update_category),
        )
}

pub async fn list_categories(
    State(context): State<Arc<ServiceContext>>,
    query: Result<Query<ListCategoriesQuery>, QueryRejection>,
) -> CategoryResult<Json<Vec<TransactionCategory>>> {
    let Query(query) = query.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .transaction_categories_service()
        .get_categories(query.parent_id.as_deref())
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to load transaction_categories", error))
}

pub async fn get_category(
    State(context): State<Arc<ServiceContext>>,
    Path(category_id): Path<String>,
) -> CategoryResult<Json<TransactionCategory>> {
    context
        .transaction_categories_service()
        .get_category(&category_id)
        .await
        .map(Json)
        .map_err(|error| {
            command_error(
                &format!("Failed to get transaction category {category_id}"),
                error,
            )
        })
}

pub async fn create_category(
    State(context): State<Arc<ServiceContext>>,
    payload: Result<Json<NewTransactionCategory>, JsonRejection>,
) -> CategoryResult<(StatusCode, Json<TransactionCategory>)> {
    let Json(new_category) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    let category_name = new_category.name.clone();
    context
        .transaction_categories_service()
        .create_category(new_category)
        .await
        .map(|category| (StatusCode::CREATED, Json(category)))
        .map_err(|error| {
            command_error(
                &format!("Failed to create transaction category {category_name}"),
                error,
            )
        })
}

pub async fn update_category(
    State(context): State<Arc<ServiceContext>>,
    Path(category_id): Path<String>,
    payload: Result<Json<UpdateCategoryRequest>, JsonRejection>,
) -> CategoryResult<Json<TransactionCategory>> {
    let Json(body) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    let category_name = body.name.clone();
    let updated_category = TransactionCategoryUpdate {
        id: category_id,
        parent_id: body.parent_id,
        name: body.name,
        description: body.description,
        color: body.color,
        role: body.role,
        confirm_budget_impact: body.confirm_budget_impact,
    };
    context
        .transaction_categories_service()
        .update_category(updated_category)
        .await
        .map(Json)
        .map_err(|error| {
            command_error(
                &format!("Failed to update transaction category {category_name}"),
                error,
            )
        })
}

pub async fn bulk_delete_categories(
    State(context): State<Arc<ServiceContext>>,
    payload: Result<Json<BulkDeleteCategoriesRequest>, JsonRejection>,
) -> CategoryResult<Json<Vec<TransactionCategory>>> {
    let Json(request) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    let category_id_refs = request
        .category_ids
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>();
    context
        .transaction_categories_service()
        .delete_categories(
            category_id_refs,
            request
                .children_strategy
                .unwrap_or(CategoryChildrenDeleteStrategy::Block),
            request.confirm_budget_impact,
        )
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to delete transaction categories", error))
}

pub async fn import_categories(
    State(context): State<Arc<ServiceContext>>,
    payload: Result<Json<ImportCategoriesRequest>, JsonRejection>,
) -> CategoryResult<Json<Vec<TransactionCategory>>> {
    let Json(request) = payload.map_err(|rejection| bad_request(rejection.body_text()))?;
    context
        .transaction_categories_service()
        .import_categories(request.categories)
        .await
        .map(Json)
        .map_err(|error| command_error("Failed to import transaction categories", error))
}
