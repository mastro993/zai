use std::fs;
use std::path::{Path, PathBuf};

const FORBIDDEN_HOSTS: &[&str] = &[
    "data-api.ecb.europa.eu",
    "sdw-wsrest.ecb.europa.eu",
    "frankfurter.dev",
    "exchangerate-api.com",
    "openexchangerates.org",
];

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|path| path.parent())
        .expect("workspace")
        .to_path_buf()
}

fn collect_sources(dir: &Path, out: &mut Vec<PathBuf>) {
    let entries = fs::read_dir(dir).unwrap_or_else(|err| panic!("read {}: {err}", dir.display()));
    for entry in entries {
        let entry = entry.expect("entry");
        let path = entry.path();
        if path.is_dir() {
            if path.file_name().and_then(|name| name.to_str()) == Some("node_modules") {
                continue;
            }
            collect_sources(&path, out);
            continue;
        }
        let Some(ext) = path.extension().and_then(|ext| ext.to_str()) else {
            continue;
        };
        if matches!(ext, "ts" | "tsx" | "js" | "rs") {
            out.push(path);
        }
    }
}

#[test]
fn frontend_and_public_transports_never_contact_a_provider() {
    let workspace = workspace_root();
    let mut sources = Vec::new();
    for relative in ["apps/frontend/src", "apps/tauri/src", "apps/server/src"] {
        collect_sources(&workspace.join(relative), &mut sources);
    }
    assert!(!sources.is_empty());
    for path in sources {
        let source = fs::read_to_string(&path).unwrap_or_else(|err| {
            panic!("read {}: {err}", path.display());
        });
        for host in FORBIDDEN_HOSTS {
            assert!(
                !source.contains(host),
                "{} contacts provider host {host}",
                path.display()
            );
        }
    }
}

#[test]
fn public_surfaces_do_not_expose_provider_refresh() {
    let workspace = workspace_root();
    for relative in [
        "apps/tauri/src/commands",
        "apps/server/src/api",
        "apps/frontend/src/features/currency",
        "apps/frontend/src/commands",
    ] {
        let mut sources = Vec::new();
        collect_sources(&workspace.join(relative), &mut sources);
        for path in sources {
            let source = fs::read_to_string(&path).expect("read");
            for needle in [
                "refresh_exchange",
                "refreshExchange",
                "ecb_refresh",
                "ecbRefresh",
            ] {
                assert!(
                    !source.contains(needle),
                    "{} exposes {needle}",
                    path.display()
                );
            }
        }
    }
}
