//! Linux has no overlay title-bar style. Disable native GTK decorations so the
//! shared 48px application header is the only chrome.

/// Hide the GTK/window-manager title bar after the main window exists.
#[cfg(target_os = "linux")]
pub fn install(window: &tauri::WebviewWindow) {
    if let Err(error) = window.set_decorations(false) {
        log::error!("Failed to disable native Linux window decorations: {error}");
    }
}

#[cfg(not(target_os = "linux"))]
pub fn install(_window: &tauri::WebviewWindow) {}
