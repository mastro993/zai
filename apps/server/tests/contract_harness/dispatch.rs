#![allow(dead_code)]

use serde_json::Value;
use zai_app::ServiceContext;
use zai_core::features::budgets::models::{BudgetUpdate, NewBudget};
use zai_core::features::transaction_categories::models::{
    CategoryChildrenDeleteStrategy, NewTransactionCategory, TransactionCategoryUpdate,
};
use zai_core::features::transactions::models::{NewTransaction, TransactionUpdate};

use super::HttpCall;
use super::helpers::{
    extract_suffix_id, lifecycle_update, parse_alerts_query, parse_budget_list_filter,
    parse_optional_query_value, parse_page_query, tauri_error, tauri_success,
};
use super::recurring;

pub async fn run_tauri_for_http(context: &ServiceContext, call: &HttpCall) -> Value {
    let path_only = call.path.split('?').next().unwrap_or(&call.path);
    match (call.method, path_only) {
        ("GET", "/api/cash-flow/budgets") => {
            let filter = parse_budget_list_filter(&call.path);
            tauri_success(
                context.budgets_service().list_budgets(filter).await,
                "Failed to load budgets",
            )
        }
        ("GET", path)
            if path.starts_with("/api/cash-flow/budgets/") && path.ends_with("/history") =>
        {
            let budget_id = extract_suffix_id(path, "/api/cash-flow/budgets/", "/history");
            let (page, per_page) = parse_page_query(&call.path, 1, 50);
            tauri_success(
                context
                    .budgets_service()
                    .get_budget_history(&budget_id, page, per_page)
                    .await,
                "Failed to load budget history",
            )
        }
        ("GET", path) if path.starts_with("/api/cash-flow/budgets/") => {
            let budget_id = extract_suffix_id(path, "/api/cash-flow/budgets/", "");
            tauri_success(
                context.budgets_service().get_budget(&budget_id).await,
                "Failed to load budget",
            )
        }
        ("POST", "/api/cash-flow/budgets") => {
            let new_budget: NewBudget =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("budget payload");
            tauri_success(
                context.budgets_service().create_budget(new_budget).await,
                "Failed to create budget",
            )
        }
        ("PUT", path) if path.starts_with("/api/cash-flow/budgets/") => {
            let budget_id = extract_suffix_id(path, "/api/cash-flow/budgets/", "");
            let update: BudgetUpdate =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("budget update");
            tauri_success(
                context
                    .budgets_service()
                    .update_budget(&budget_id, update)
                    .await,
                "Failed to update budget",
            )
        }
        ("POST", path)
            if path.starts_with("/api/cash-flow/budgets/") && path.ends_with("/pause") =>
        {
            let budget_id = extract_suffix_id(path, "/api/cash-flow/budgets/", "/pause");
            let update = lifecycle_update(call.body.as_ref());
            tauri_success(
                context
                    .budgets_service()
                    .pause_budget(&budget_id, update)
                    .await,
                "Failed to pause budget",
            )
        }
        ("POST", path)
            if path.starts_with("/api/cash-flow/budgets/") && path.ends_with("/resume") =>
        {
            let budget_id = extract_suffix_id(path, "/api/cash-flow/budgets/", "/resume");
            let update = lifecycle_update(call.body.as_ref());
            tauri_success(
                context
                    .budgets_service()
                    .resume_budget(&budget_id, update)
                    .await,
                "Failed to resume budget",
            )
        }
        ("DELETE", path) if path.starts_with("/api/cash-flow/budgets/") => {
            let budget_id = extract_suffix_id(path, "/api/cash-flow/budgets/", "");
            let update = lifecycle_update(call.body.as_ref());
            match context
                .budgets_service()
                .delete_budget(&budget_id, update)
                .await
            {
                Ok(()) => Value::Null,
                Err(error) => tauri_error("Failed to delete budget", error),
            }
        }
        ("GET", "/api/cash-flow/categories") => {
            let parent_id = parse_optional_query_value(&call.path, "parentId");
            tauri_success(
                context
                    .transaction_categories_service()
                    .get_categories(parent_id.as_deref())
                    .await,
                "Failed to load transaction categories",
            )
        }
        ("GET", path) if path.starts_with("/api/cash-flow/categories/") => {
            let category_id = extract_suffix_id(path, "/api/cash-flow/categories/", "");
            tauri_success(
                context
                    .transaction_categories_service()
                    .get_category(&category_id)
                    .await,
                "Failed to load transaction category",
            )
        }
        ("POST", "/api/cash-flow/categories") => {
            let new_category: NewTransactionCategory =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("category payload");
            tauri_success(
                context
                    .transaction_categories_service()
                    .create_category(new_category)
                    .await,
                "Failed to create transaction category",
            )
        }
        ("PUT", path) if path.starts_with("/api/cash-flow/categories/") => {
            let category_id = extract_suffix_id(path, "/api/cash-flow/categories/", "");
            let body = call.body.clone().unwrap_or(Value::Null);
            let updated_category = TransactionCategoryUpdate {
                id: category_id,
                parent_id: body
                    .get("parentId")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                name: body["name"].as_str().expect("name").to_string(),
                description: body
                    .get("description")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                color: body
                    .get("color")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                role: body
                    .get("role")
                    .and_then(|value| serde_json::from_value(value.clone()).ok()),
                confirm_budget_impact: body
                    .get("confirmBudgetImpact")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
            };
            tauri_success(
                context
                    .transaction_categories_service()
                    .update_category(updated_category)
                    .await,
                "Failed to update transaction category",
            )
        }
        ("POST", "/api/cash-flow/categories/bulk-delete") => {
            let body = call.body.clone().unwrap_or(Value::Null);
            let category_ids = body["categoryIds"]
                .as_array()
                .expect("category ids")
                .iter()
                .map(|value| value.as_str().expect("category id").to_string())
                .collect::<Vec<_>>();
            let children_strategy = body
                .get("childrenStrategy")
                .and_then(|value| serde_json::from_value(value.clone()).ok())
                .unwrap_or(CategoryChildrenDeleteStrategy::Block);
            let confirm_budget_impact = body
                .get("confirmBudgetImpact")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let category_id_refs = category_ids.iter().map(String::as_str).collect::<Vec<_>>();
            tauri_success(
                context
                    .transaction_categories_service()
                    .delete_categories(category_id_refs, children_strategy, confirm_budget_impact)
                    .await,
                "Failed to delete transaction categories",
            )
        }
        ("POST", "/api/cash-flow/categories/import") => {
            let body = call.body.clone().unwrap_or(Value::Null);
            let categories: Vec<NewTransactionCategory> =
                serde_json::from_value(body["categories"].clone()).expect("categories");
            tauri_success(
                context
                    .transaction_categories_service()
                    .import_categories(categories)
                    .await,
                "Failed to import transaction categories",
            )
        }
        ("GET", "/api/cash-flow/transactions") => {
            let (page, per_page) = parse_page_query(&call.path, 1, 50);
            tauri_success(
                context
                    .transactions_service()
                    .get_transactions(page, per_page, None, None)
                    .await,
                "Failed to load transactions",
            )
        }
        ("GET", path) if path.starts_with("/api/cash-flow/transactions/") => {
            let transaction_id = extract_suffix_id(path, "/api/cash-flow/transactions/", "");
            tauri_success(
                context
                    .transactions_service()
                    .get_transaction(&transaction_id)
                    .await,
                "Failed to load transaction",
            )
        }
        ("POST", "/api/cash-flow/transactions") => {
            let new_transaction: NewTransaction =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("transaction payload");
            tauri_success(
                context
                    .transactions_service()
                    .create_transaction(new_transaction)
                    .await,
                "Failed to create transaction",
            )
        }
        ("PUT", path) if path.starts_with("/api/cash-flow/transactions/") => {
            let transaction_id = extract_suffix_id(path, "/api/cash-flow/transactions/", "");
            let body = call.body.clone().unwrap_or(Value::Null);
            let update = TransactionUpdate {
                id: transaction_id,
                description: body
                    .get("description")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                amount: body["amount"].as_i64().expect("amount") as i32,
                transaction_date: serde_json::from_value(body["transactionDate"].clone())
                    .expect("transaction date"),
                transaction_type: body["transactionType"]
                    .as_str()
                    .expect("transaction type")
                    .to_string(),
                transaction_category_id: body
                    .get("transactionCategoryId")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                notes: body
                    .get("notes")
                    .and_then(Value::as_str)
                    .map(str::to_string),
            };
            tauri_success(
                context
                    .transactions_service()
                    .update_transaction(update)
                    .await,
                "Failed to update transaction",
            )
        }
        ("DELETE", path) if path.starts_with("/api/cash-flow/transactions/") => {
            let transaction_id = extract_suffix_id(path, "/api/cash-flow/transactions/", "");
            tauri_success(
                context
                    .transactions_service()
                    .delete_transaction(&transaction_id)
                    .await,
                "Failed to delete transaction",
            )
        }
        ("POST", "/api/cash-flow/transactions/bulk-delete") => {
            let body = call.body.clone().unwrap_or(Value::Null);
            let transaction_ids = body["transactionIds"]
                .as_array()
                .expect("transaction ids")
                .iter()
                .map(|value| value.as_str().expect("transaction id"))
                .collect::<Vec<_>>();
            tauri_success(
                context
                    .transactions_service()
                    .delete_transactions(transaction_ids)
                    .await,
                "Failed to delete transactions",
            )
        }
        ("POST", "/api/cash-flow/transactions/import") => {
            let body = call.body.clone().unwrap_or(Value::Null);
            let transactions: Vec<NewTransaction> =
                serde_json::from_value(body["transactions"].clone()).expect("transactions");
            tauri_success(
                context
                    .transactions_service()
                    .import_transactions(transactions)
                    .await,
                "Failed to import transactions",
            )
        }
        ("POST", "/api/cash-flow/transactions/import-batch") => {
            let body = call.body.clone().unwrap_or(Value::Null);
            let categories: Vec<NewTransactionCategory> =
                serde_json::from_value(body["categories"].clone()).expect("categories");
            let transactions: Vec<NewTransaction> =
                serde_json::from_value(body["transactions"].clone()).expect("transactions");
            tauri_success(
                context
                    .transactions_service()
                    .import_transactions_with_categories(categories, transactions)
                    .await
                    .map(|(_, transactions)| transactions),
                "Failed to import transaction batch",
            )
        }
        ("GET", "/api/alerts") => {
            let query = parse_alerts_query(&call.path);
            tauri_success(
                context.domain_alerts_service().list_alerts(query).await,
                "Failed to load alerts",
            )
        }
        ("GET", "/api/alerts/unread-count") => tauri_success(
            context.domain_alerts_service().unread_count().await,
            "Failed to load unread alert count",
        ),
        ("POST", "/api/alerts/mark-all-read") => tauri_success(
            context.domain_alerts_service().mark_all_read().await,
            "Failed to mark all alerts read",
        ),
        ("POST", path) if path.starts_with("/api/alerts/") && path.ends_with("/read") => {
            let alert_id = extract_suffix_id(path, "/api/alerts/", "/read");
            tauri_success(
                context.domain_alerts_service().mark_read(&alert_id).await,
                "Failed to mark alert read",
            )
        }
        ("POST", path) if path.starts_with("/api/alerts/") && path.ends_with("/unread") => {
            let alert_id = extract_suffix_id(path, "/api/alerts/", "/unread");
            tauri_success(
                context.domain_alerts_service().mark_unread(&alert_id).await,
                "Failed to mark alert unread",
            )
        }
        _ => {
            if let Some(value) = recurring::try_run_tauri_for_recurring(context, call).await {
                value
            } else {
                panic!("unsupported contract call: {} {}", call.method, call.path)
            }
        }
    }
}
