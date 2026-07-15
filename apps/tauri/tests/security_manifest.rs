use serde::Deserialize;
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
struct CapabilityFile {
    identifier: String,
    permissions: Vec<CapabilityPermission>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum CapabilityPermission {
    Named(String),
    Scoped {
        identifier: String,
        #[allow(dead_code)]
        allow: Vec<serde_json::Value>,
    },
}

fn manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn permission_identifiers(capability: &CapabilityFile) -> BTreeSet<String> {
    capability
        .permissions
        .iter()
        .map(|permission| match permission {
            CapabilityPermission::Named(name) => name.clone(),
            CapabilityPermission::Scoped { identifier, .. } => identifier.clone(),
        })
        .collect()
}

fn load_main_capability(manifest_dir: &Path) -> CapabilityFile {
    let path = manifest_dir.join("capabilities/default.json");
    let source = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
    serde_json::from_str(&source)
        .unwrap_or_else(|error| panic!("failed to parse {}: {error}", path.display()))
}

const REQUIRED_MAIN_PERMISSIONS: &[(&str, &str)] = &[
    ("core:default", "IPC invoke transport"),
    ("core:path:default", "documentDir default save path"),
    ("core:event:default", "domain alert event listen"),
    ("dialog:allow-open", "CSV import file picker"),
    ("dialog:allow-save", "CSV export save dialog"),
    ("fs:allow-read-text-file", "dialog-selected CSV read"),
    ("fs:allow-write-text-file", "dialog-selected CSV write"),
    ("log:default", "desktop log sink"),
];

const FORBIDDEN_MAIN_PERMISSIONS: &[(&str, &str)] = &[
    ("shell:default", "no shell consumer"),
    ("store:default", "no store consumer"),
    ("stronghold:default", "no renderer stronghold consumer"),
    ("fs:default", "recursive app filesystem access"),
    ("fs:allow-app-write", "unused app directory write"),
    ("fs:allow-app-write-recursive", "unused recursive app write"),
    ("fs:allow-appcache-write", "unused app cache write"),
    (
        "fs:allow-appcache-write-recursive",
        "unused recursive app cache write",
    ),
    ("fs:allow-appcache-read", "unused app cache read"),
    (
        "fs:allow-appcache-read-recursive",
        "unused recursive app cache read",
    ),
];

#[test]
fn main_capability_matches_documented_consumers() {
    let capability = load_main_capability(&manifest_dir());
    let permissions = permission_identifiers(&capability);

    assert_eq!(capability.identifier, "default");

    for (permission, consumer) in REQUIRED_MAIN_PERMISSIONS {
        assert!(
            permissions.contains(*permission),
            "missing required permission {permission} for {consumer}"
        );
    }

    for (permission, reason) in FORBIDDEN_MAIN_PERMISSIONS {
        assert!(
            !permissions.contains(*permission),
            "forbidden permission {permission} present: {reason}"
        );
    }

    assert_eq!(
        permissions.len(),
        REQUIRED_MAIN_PERMISSIONS.len(),
        "unexpected extra permissions: {:?}",
        permissions
            .difference(
                &REQUIRED_MAIN_PERMISSIONS
                    .iter()
                    .map(|(permission, _)| (*permission).to_string())
                    .collect(),
            )
            .collect::<Vec<_>>()
    );
}

#[test]
fn production_csp_is_restrictive_and_dev_csp_is_isolated() {
    let config_path = manifest_dir().join("tauri.conf.json");
    let source = fs::read_to_string(&config_path).expect("tauri config should exist");
    let config: serde_json::Value =
        serde_json::from_str(&source).expect("tauri config should parse");

    let security = &config["app"]["security"];
    let production_csp = security["csp"]
        .as_object()
        .expect("production CSP should be configured");
    let development_csp = security["devCsp"]
        .as_object()
        .expect("development CSP should be configured separately");

    let production_blob = serde_json::to_string(production_csp).expect("csp serializes");
    assert!(
        !production_blob.contains('*'),
        "production CSP must not use wildcards"
    );
    assert!(
        !production_blob.contains("unsafe-eval"),
        "production CSP must not allow unsafe-eval"
    );

    let development_blob = serde_json::to_string(development_csp).expect("dev csp serializes");
    assert!(
        development_blob.contains("127.0.0.1:1420"),
        "development CSP should allow the Vite dev server"
    );
    assert_ne!(
        production_blob, development_blob,
        "development CSP override should differ from production"
    );
}

#[test]
fn invoke_handler_exposes_no_credential_commands() {
    let lib_source =
        fs::read_to_string(manifest_dir().join("src/lib.rs")).expect("lib.rs should exist");

    assert!(
        !lib_source.contains("get_stronghold_vault_password"),
        "renderer must not invoke credential-returning commands"
    );
    assert!(
        !lib_source.contains("tauri_plugin_stronghold"),
        "unused stronghold plugin should not be initialized"
    );
    assert!(
        !lib_source.contains("tauri_plugin_store"),
        "unused store plugin should not be initialized"
    );
    assert!(
        !lib_source.contains("tauri_plugin_shell"),
        "unused shell plugin should not be initialized"
    );
}
