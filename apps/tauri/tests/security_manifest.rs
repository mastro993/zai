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
    ("core:path:default", "documentDir default save path"),
    ("core:event:default", "domain alert event listen"),
    (
        "core:window:allow-start-dragging",
        "manual desktop title-bar dragging",
    ),
    (
        "core:window:allow-toggle-maximize",
        "manual desktop title-bar maximization",
    ),
    (
        "core:window:allow-minimize",
        "Linux client-side minimize control",
    ),
    ("core:window:allow-close", "Linux client-side close control"),
    ("dialog:allow-open", "CSV import file picker"),
    ("dialog:allow-save", "CSV export save dialog"),
    ("dialog:allow-message", "native update confirmation"),
    ("fs:allow-read-text-file", "dialog-selected CSV read"),
    ("fs:allow-write-text-file", "dialog-selected CSV write"),
    ("log:default", "desktop log sink"),
    (
        "process:allow-restart",
        "restart after installing an update",
    ),
    ("updater:allow-check", "signed update availability check"),
    (
        "updater:allow-download-and-install",
        "signed update download and installation",
    ),
];

const FORBIDDEN_MAIN_PERMISSIONS: &[(&str, &str)] = &[
    (
        "core:default",
        "broad core default includes unrequested window permissions",
    ),
    ("shell:default", "no shell consumer"),
    (
        "opener:default",
        "diagnostic locations use trusted backend commands",
    ),
    (
        "opener:allow-open-path",
        "renderer must not open arbitrary filesystem paths",
    ),
    (
        "opener:allow-reveal-item-in-dir",
        "renderer must not reveal arbitrary filesystem paths",
    ),
    ("process:default", "only restart is required"),
    (
        "updater:default",
        "only check and download-and-install are required",
    ),
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
fn updater_uses_signed_pages_manifests() {
    let config_path = manifest_dir().join("tauri.conf.json");
    let source = fs::read_to_string(&config_path).expect("tauri config should exist");
    let config: serde_json::Value =
        serde_json::from_str(&source).expect("tauri config should parse");
    let updater = &config["plugins"]["updater"];

    assert_eq!(config["bundle"]["createUpdaterArtifacts"], true);
    assert_eq!(
        updater["endpoints"][0],
        "https://mastro993.github.io/zai/updater/{{target}}.json"
    );
    assert!(
        updater["pubkey"]
            .as_str()
            .is_some_and(|key| !key.is_empty()),
        "updater public key must be committed"
    );
    assert_eq!(updater["windows"]["installMode"], "passive");
}

#[test]
fn main_window_uses_native_overlay_chrome() {
    let config_path = manifest_dir().join("tauri.conf.json");
    let source = fs::read_to_string(&config_path).expect("tauri config should exist");
    let config: serde_json::Value =
        serde_json::from_str(&source).expect("tauri config should parse");
    let windows = config["app"]["windows"]
        .as_array()
        .expect("app windows should be configured");
    let main_window = windows
        .iter()
        .find(|window| window["label"] == "main")
        .expect("main window should be configured");

    assert_eq!(main_window["decorations"], true);
    assert_eq!(main_window["titleBarStyle"], "Overlay");
    assert_eq!(main_window["hiddenTitle"], true);
    // Traffic-light Y is applied at runtime (macos_traffic_lights), not via config.
    assert!(main_window.get("trafficLightPosition").is_none());
}

#[test]
fn linux_main_window_uses_client_side_chrome() {
    let config_path = manifest_dir().join("tauri.linux.conf.json");
    let source = fs::read_to_string(&config_path).expect("linux tauri config should exist");
    let config: serde_json::Value =
        serde_json::from_str(&source).expect("linux tauri config should parse");
    let windows = config["app"]["windows"]
        .as_array()
        .expect("linux app windows should be configured");
    let main_window = windows
        .iter()
        .find(|window| window["label"] == "main")
        .expect("linux main window should be configured");

    assert_eq!(main_window["decorations"], false);

    let base_source = fs::read_to_string(manifest_dir().join("tauri.conf.json"))
        .expect("tauri config should exist");
    let base_config: serde_json::Value =
        serde_json::from_str(&base_source).expect("tauri config should parse");
    let base_windows = base_config["app"]["windows"]
        .as_array()
        .expect("app windows should be configured");
    let base_window = base_windows
        .iter()
        .find(|window| window["label"] == "main")
        .expect("main window should be configured");

    let mut expected = base_window.clone();
    expected["decorations"] = serde_json::Value::Bool(false);
    assert_eq!(
        main_window, &expected,
        "linux window config should match the shared window except decorations"
    );
}

#[test]
fn linux_client_chrome_disables_native_decorations() {
    let source = fs::read_to_string(manifest_dir().join("src/linux_client_chrome.rs"))
        .expect("linux_client_chrome.rs should exist");
    assert!(
        source.contains("set_decorations(false)"),
        "Linux startup should hide native GTK decorations"
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
    assert!(
        lib_source.contains("tauri_plugin_process::init()"),
        "process plugin should support relaunch after updates"
    );
    assert!(
        lib_source.contains("tauri_plugin_updater::Builder::new().build()"),
        "updater plugin should be initialized"
    );
}
