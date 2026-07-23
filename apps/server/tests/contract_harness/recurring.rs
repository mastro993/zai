use serde_json::Value;
use zai_app::ServiceContext;
use zai_core::features::recurring_transactions::{
    AdoptRecurringTransaction, AdoptionPreviewRequest, BudgetProjectionQuery,
    NewRecurringTransaction, PreviewRecurringGenerationRepair, RecurringBulkRequest,
    RecurringLifecycleUpdate, RecurringProcessingStatusView, RepairRecurringGenerationFailure,
    RetryRecurringGenerationFailure, UpdateRecurringTransaction,
};

use super::HttpCall;
use super::helpers::{extract_suffix_id, parse_optional_query_value, tauri_success};

pub async fn try_run_tauri_for_recurring(
    context: &ServiceContext,
    call: &HttpCall,
) -> Option<Value> {
    let path_only = call.path.split('?').next().unwrap_or(&call.path);
    let value = match (call.method, path_only) {
        ("GET", "/api/cash-flow/recurring-processing/status") => {
            serde_json::to_value(RecurringProcessingStatusView {
                status: context.recurring_processing_supervisor().status(),
            })
            .expect("serialize status")
        }
        ("GET", "/api/cash-flow/recurring-transactions") => {
            let limit = parse_optional_query_value(&call.path, "limit")
                .and_then(|value| value.parse().ok());
            let cursor = parse_optional_query_value(&call.path, "cursor");
            tauri_success(
                context
                    .recurring_transactions_service()
                    .list_feed(limit, cursor)
                    .await,
                "Failed to load recurring transactions",
            )
        }
        ("GET", "/api/cash-flow/recurring-transactions/ids") => tauri_success(
            context
                .recurring_transactions_service()
                .list_matching_ids()
                .await,
            "Failed to resolve matching recurring ids",
        ),
        ("GET", "/api/cash-flow/recurring-transactions/budget-projections") => {
            let horizon_months = parse_optional_query_value(&call.path, "horizonMonths")
                .and_then(|value| value.parse().ok())
                .unwrap_or(3);
            let include_paused_budgets =
                parse_optional_query_value(&call.path, "includePausedBudgets")
                    .map(|value| value == "true")
                    .unwrap_or(false);
            let focus_recurring_transaction_id =
                parse_optional_query_value(&call.path, "focusRecurringTransactionId");
            tauri_success(
                context
                    .recurring_transactions_service()
                    .project_budgets(BudgetProjectionQuery {
                        horizon_months,
                        include_paused_budgets,
                        focus_recurring_transaction_id,
                    })
                    .await,
                "Failed to load budget projections",
            )
        }
        ("GET", path) if path.starts_with("/api/cash-flow/recurring-transactions/provenance/") => {
            let transaction_id = extract_suffix_id(
                path,
                "/api/cash-flow/recurring-transactions/provenance/",
                "",
            );
            tauri_success(
                context
                    .recurring_transactions_service()
                    .get_transaction_provenance(&transaction_id)
                    .await,
                "Failed to load transaction provenance",
            )
        }
        ("POST", "/api/cash-flow/recurring-transactions") => {
            let payload: NewRecurringTransaction =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("recurring create payload");
            tauri_success(
                context
                    .recurring_transactions_service()
                    .create(payload)
                    .await,
                "Failed to create recurring transaction",
            )
        }
        ("POST", "/api/cash-flow/recurring-transactions/adoption-preview") => {
            let request: AdoptionPreviewRequest =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("adoption preview");
            tauri_success(
                context
                    .recurring_transactions_service()
                    .preview_adoption(request)
                    .await,
                "Failed to preview adoption",
            )
        }
        ("POST", "/api/cash-flow/recurring-transactions/adopt") => {
            let request: AdoptRecurringTransaction =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("adoption payload");
            tauri_success(
                context
                    .recurring_transactions_service()
                    .adopt(request)
                    .await,
                "Failed to adopt transaction",
            )
        }
        ("POST", "/api/cash-flow/recurring-transactions/bulk/preflight") => {
            let request: RecurringBulkRequest =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("bulk preflight");
            tauri_success(
                context
                    .recurring_transactions_service()
                    .preflight_bulk(request)
                    .await,
                "Failed to preflight recurring bulk action",
            )
        }
        ("POST", "/api/cash-flow/recurring-transactions/bulk/execute") => {
            let request: RecurringBulkRequest =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("bulk execute");
            tauri_success(
                context
                    .recurring_transactions_service()
                    .execute_bulk(request)
                    .await,
                "Failed to execute recurring bulk action",
            )
        }
        ("GET", path)
            if path.starts_with("/api/cash-flow/recurring-transactions/")
                && path.ends_with("/occurrences") =>
        {
            let recurring_transaction_id = extract_suffix_id(
                path,
                "/api/cash-flow/recurring-transactions/",
                "/occurrences",
            );
            let limit = parse_optional_query_value(&call.path, "limit")
                .and_then(|value| value.parse().ok());
            let cursor = parse_optional_query_value(&call.path, "cursor");
            tauri_success(
                context
                    .recurring_transactions_service()
                    .list_linked_occurrences(&recurring_transaction_id, limit, cursor)
                    .await,
                "Failed to load recurring occurrences",
            )
        }
        ("GET", path)
            if path.starts_with("/api/cash-flow/recurring-transactions/")
                && path.ends_with("/failures") =>
        {
            let recurring_transaction_id =
                extract_suffix_id(path, "/api/cash-flow/recurring-transactions/", "/failures");
            let limit = parse_optional_query_value(&call.path, "limit")
                .and_then(|value| value.parse().ok());
            let cursor = parse_optional_query_value(&call.path, "cursor");
            tauri_success(
                context
                    .recurring_transactions_service()
                    .list_failure_history(&recurring_transaction_id, limit, cursor)
                    .await,
                "Failed to load failure history",
            )
        }
        ("GET", path)
            if path.starts_with("/api/cash-flow/recurring-transactions/")
                && path.ends_with("/diagnostics") =>
        {
            let recurring_transaction_id = extract_suffix_id(
                path,
                "/api/cash-flow/recurring-transactions/",
                "/diagnostics",
            );
            tauri_success(
                context
                    .recurring_transactions_service()
                    .generation_failure_diagnostics(&recurring_transaction_id)
                    .await,
                "Failed to load generation failure diagnostics",
            )
        }
        ("GET", path) if path.starts_with("/api/cash-flow/recurring-transactions/") => {
            let recurring_transaction_id =
                extract_suffix_id(path, "/api/cash-flow/recurring-transactions/", "");
            tauri_success(
                context
                    .recurring_transactions_service()
                    .get_document(&recurring_transaction_id)
                    .await,
                "Failed to load recurring transaction",
            )
        }
        ("POST", path)
            if path.starts_with("/api/cash-flow/recurring-transactions/")
                && path.ends_with("/pause") =>
        {
            lifecycle(context, path, "/pause", "pause", call).await
        }
        ("POST", path)
            if path.starts_with("/api/cash-flow/recurring-transactions/")
                && path.ends_with("/resume") =>
        {
            lifecycle(context, path, "/resume", "resume", call).await
        }
        ("POST", path)
            if path.starts_with("/api/cash-flow/recurring-transactions/")
                && path.ends_with("/stop") =>
        {
            lifecycle(context, path, "/stop", "stop", call).await
        }
        ("POST", path)
            if path.starts_with("/api/cash-flow/recurring-transactions/")
                && path.ends_with("/delete") =>
        {
            lifecycle(context, path, "/delete", "delete", call).await
        }
        ("POST", path)
            if path.starts_with("/api/cash-flow/recurring-transactions/")
                && path.ends_with("/repair/preview") =>
        {
            let mut request: PreviewRecurringGenerationRepair =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("repair preview");
            request.recurring_transaction_id = extract_suffix_id(
                path,
                "/api/cash-flow/recurring-transactions/",
                "/repair/preview",
            );
            tauri_success(
                context
                    .recurring_transactions_service()
                    .preview_generation_repair(request)
                    .await,
                "Failed to preview generation repair",
            )
        }
        ("POST", path)
            if path.starts_with("/api/cash-flow/recurring-transactions/")
                && path.ends_with("/repair") =>
        {
            let mut input: RepairRecurringGenerationFailure =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("repair payload");
            input.recurring_transaction_id =
                extract_suffix_id(path, "/api/cash-flow/recurring-transactions/", "/repair");
            tauri_success(
                context
                    .recurring_transactions_service()
                    .repair_and_retry(input)
                    .await,
                "Failed to repair generation failure",
            )
        }
        ("POST", path)
            if path.starts_with("/api/cash-flow/recurring-transactions/")
                && path.ends_with("/retry") =>
        {
            let body = call.body.clone().unwrap_or(Value::Null);
            let expected_revision = body["expectedRevision"].as_i64().expect("revision") as i32;
            let recurring_transaction_id =
                extract_suffix_id(path, "/api/cash-flow/recurring-transactions/", "/retry");
            tauri_success(
                context
                    .recurring_transactions_service()
                    .retry_generation(RetryRecurringGenerationFailure {
                        recurring_transaction_id,
                        expected_revision,
                    })
                    .await,
                "Failed to retry generation",
            )
        }
        ("POST", path) if path.starts_with("/api/cash-flow/recurring-transactions/") => {
            let mut input: UpdateRecurringTransaction =
                serde_json::from_value(call.body.clone().unwrap_or(Value::Null))
                    .expect("update payload");
            input.recurring_transaction_id =
                extract_suffix_id(path, "/api/cash-flow/recurring-transactions/", "");
            tauri_success(
                context.recurring_transactions_service().update(input).await,
                "Failed to update recurring transaction",
            )
        }
        _ => return None,
    };
    Some(value)
}

async fn lifecycle(
    context: &ServiceContext,
    path: &str,
    suffix: &str,
    action: &str,
    call: &HttpCall,
) -> Value {
    let recurring_transaction_id =
        extract_suffix_id(path, "/api/cash-flow/recurring-transactions/", suffix);
    let body = call.body.clone().unwrap_or(Value::Null);
    let update = RecurringLifecycleUpdate {
        recurring_transaction_id,
        expected_revision: body["expectedRevision"].as_i64().expect("revision") as i32,
    };
    let service = context.recurring_transactions_service();
    let result = match action {
        "pause" => service.pause(update).await,
        "resume" => service.resume(update).await,
        "stop" => service.stop(update).await,
        "delete" => service.delete(update).await,
        _ => unreachable!("unsupported lifecycle action"),
    };
    tauri_success(
        result,
        match action {
            "pause" => "Failed to pause recurring transaction",
            "resume" => "Failed to resume recurring transaction",
            "stop" => "Failed to stop recurring transaction",
            "delete" => "Failed to delete recurring transaction",
            _ => unreachable!(),
        },
    )
}
