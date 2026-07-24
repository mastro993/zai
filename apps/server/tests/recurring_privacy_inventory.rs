#![allow(dead_code, unused_imports)]

use std::path::PathBuf;

#[test]
fn public_inventory_keeps_process_due_as_internal_port_only() {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let workspace = manifest
        .parent()
        .and_then(|path| path.parent())
        .expect("workspace");

    let tauri_lib = std::fs::read_to_string(workspace.join("apps/tauri/src/lib.rs")).expect("lib");
    let tauri_commands = std::fs::read_to_string(
        workspace.join("apps/tauri/src/commands/recurring_transactions.rs"),
    )
    .expect("commands");
    let server_api = std::fs::read_to_string(
        workspace.join("apps/server/src/api/cash_flow/recurring_transactions.rs"),
    )
    .expect("api");
    let events_api = std::fs::read_to_string(
        workspace.join("apps/server/src/api/cash_flow/recurring_processing_events.rs"),
    )
    .expect("events api");
    let bulk_api =
        std::fs::read_to_string(workspace.join("apps/server/src/api/cash_flow/recurring_bulk.rs"))
            .expect("bulk api");
    let traits = std::fs::read_to_string(
        workspace.join("crates/core/src/features/recurring_transactions/traits.rs"),
    )
    .expect("traits");

    for (label, source) in [
        ("tauri lib", tauri_lib.as_str()),
        ("tauri commands", tauri_commands.as_str()),
        ("recurring api", server_api.as_str()),
        ("processing api", events_api.as_str()),
        ("bulk api", bulk_api.as_str()),
    ] {
        assert!(
            !source.contains("process_due")
                && !source.contains("process-due")
                && !source.contains("processDue"),
            "{label} exposes process_due"
        );
    }

    assert!(
        traits.contains("async fn process_due("),
        "internal RecurringOccurrenceProcessor::process_due port must remain"
    );
    assert!(
        traits.contains("Not exposed through Tauri IPC or public Axum REST endpoints"),
        "process_due must stay documented as internal"
    );
}

#[test]
fn recurring_command_logs_have_no_dynamic_user_fields() {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let workspace = manifest
        .parent()
        .and_then(|path| path.parent())
        .expect("workspace");
    let source = std::fs::read_to_string(
        workspace.join("apps/tauri/src/commands/recurring_transactions.rs"),
    )
    .expect("recurring commands");

    for line in source.lines().filter(|line| line.contains("debug!")) {
        assert!(
            !line.contains('{')
                && !line.contains("transaction_id")
                && !line.contains("description")
                && !line.contains("amount")
                && !line.contains("account")
                && !line.contains("category")
                && !line.contains("name"),
            "recurring log line contains user data: {line}"
        );
    }
}
