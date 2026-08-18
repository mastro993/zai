use serde_json::{Value, json};

use super::payload::FailureClass;

pub fn refresh_failure_public_facts(class: FailureClass, elapsed_ms: u64) -> Value {
    json!({
        "class": class.as_str(),
        "elapsedMs": elapsed_ms,
    })
}

pub fn refresh_log_line(class: &str, elapsed_ms: u64) -> String {
    format!("provider_refresh class={class} elapsed_ms={elapsed_ms}")
}
