#![allow(dead_code)]

use serde_json::Value;

pub(crate) fn normalize_response_body(value: &mut Value) {
    match value {
        Value::Array(items) => {
            for item in &mut *items {
                normalize_response_body(item);
            }
            items.sort_by(|left, right| {
                left["name"]
                    .as_str()
                    .or(left["title"].as_str())
                    .or(left["id"].as_str())
                    .unwrap_or_default()
                    .cmp(
                        right["name"]
                            .as_str()
                            .or(right["title"].as_str())
                            .or(right["id"].as_str())
                            .unwrap_or_default(),
                    )
            });
        }
        Value::Null => {}
        _ if value.get("data").is_some() => normalize_paginated(value),
        _ if value.get("items").is_some() => normalize_items_page(value),
        _ => normalize_entity(value),
    }
}

fn normalize_paginated(value: &mut Value) {
    let Some(object) = value.as_object_mut() else {
        return;
    };
    if let Some(rows) = object.get_mut("data").and_then(Value::as_array_mut) {
        for row in &mut *rows {
            normalize_entity(row);
        }
    }
}

fn normalize_items_page(value: &mut Value) {
    let looks_like_recurring_feed = value
        .get("items")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .is_some_and(|item| item.get("recurringTransaction").is_some());

    let Some(object) = value.as_object_mut() else {
        return;
    };
    if let Some(items) = object.get_mut("items").and_then(Value::as_array_mut) {
        for item in &mut *items {
            normalize_entity(item);
        }
        if !looks_like_recurring_feed {
            items.sort_by(|left, right| {
                left["title"]
                    .as_str()
                    .unwrap_or_default()
                    .cmp(right["title"].as_str().unwrap_or_default())
            });
        }
    }
    object.remove("nextCursor");
}

fn normalize_entity(value: &mut Value) {
    match value {
        Value::Object(object) => {
            for key in [
                "createdAt",
                "updatedAt",
                "readAt",
                "lifecycleChangedAt",
                "deletedAt",
                "firstFailedAt",
                "lastFailedAt",
                "repairedAt",
                "resolvedAt",
                "observedLocal",
                "throughLocal",
                "pausedAt",
                "scheduleRevisionId",
                "templateRevisionId",
                "id",
                "occurrenceKey",
                "transactionDate",
                "transactionId",
                "recurringAlertId",
                "recurringTransactionId",
                "fulfilledAt",
                "generationFailureAlertId",
                "correlationId",
            ] {
                object.remove(key);
            }
            if let Some(outcome) = object.get_mut("outcome")
                && outcome.as_str() == Some("alreadyApplied")
            {
                *outcome = Value::String("succeeded".to_string());
            }
            if let Some(period) = object
                .get_mut("currentPeriod")
                .and_then(Value::as_object_mut)
            {
                period.remove("start");
                period.remove("end");
            }
            if let Some(rows) = object.get_mut("data").and_then(Value::as_array_mut) {
                for row in rows {
                    if let Some(period) = row.as_object_mut() {
                        period.remove("start");
                        period.remove("end");
                    }
                }
            }
            for child in object.values_mut() {
                normalize_entity(child);
            }
        }
        Value::Array(items) => {
            for item in items {
                normalize_entity(item);
            }
        }
        _ => {}
    }
}
