//! Vertically center macOS traffic lights in the app's 48px header.
//!
//! Tauri's `trafficLightPosition.y` only expands the title-bar container
//! (`button_height + y`) and leaves button `origin.y` untouched. That is not
//! enough to center controls in a custom header, so we set frame origins
//! ourselves after the window exists.

/// Position traffic lights and re-apply after layout-affecting window events.
#[cfg(target_os = "macos")]
pub fn install(window: &tauri::WebviewWindow) {
    use tauri::Manager;

    /// Matches the frontend application title bar (`h-12` / 48px).
    const HEADER_HEIGHT: f64 = 48.0;
    /// Leading inset for the close button cluster.
    const TRAFFIC_LIGHT_X: f64 = 16.0;

    apply(window, TRAFFIC_LIGHT_X, HEADER_HEIGHT);

    let label = window.label().to_string();
    let app = window.app_handle().clone();
    window.on_window_event(move |event| {
        use tauri::WindowEvent;
        match event {
            WindowEvent::Resized(_)
            | WindowEvent::ScaleFactorChanged { .. }
            | WindowEvent::ThemeChanged(_) => {
                if let Some(win) = app.get_webview_window(&label) {
                    apply(&win, TRAFFIC_LIGHT_X, HEADER_HEIGHT);
                }
            }
            _ => {}
        }
    });
}

#[cfg(target_os = "macos")]
fn apply(window: &tauri::WebviewWindow, traffic_light_x: f64, header_height: f64) {
    use objc2::rc::Retained;
    use objc2_app_kit::NSWindow;

    let Ok(ns_window_ptr) = window.ns_window() else {
        return;
    };

    // Pointer from Tauri is an autoreleased NSWindow*.
    let Some(ns_window) =
        (unsafe { Retained::retain_autoreleased(ns_window_ptr.cast::<NSWindow>()) })
    else {
        return;
    };

    inset_and_center(&ns_window, traffic_light_x, header_height);
}

#[cfg(target_os = "macos")]
fn inset_and_center(window: &objc2_app_kit::NSWindow, x: f64, header_height: f64) {
    use objc2_app_kit::{NSView, NSWindowButton};

    // objc2 AppKit view geometry is `unsafe` because callers must keep the
    // NSWindow alive and only mutate UI on the main thread (Tauri setup is).
    unsafe {
        let Some(close) = window.standardWindowButton(NSWindowButton::CloseButton) else {
            return;
        };
        let Some(miniaturize) = window.standardWindowButton(NSWindowButton::MiniaturizeButton)
        else {
            return;
        };
        let zoom = window.standardWindowButton(NSWindowButton::ZoomButton);

        let Some(close_superview) = close.superview() else {
            return;
        };
        let Some(title_bar_container) = close_superview.superview() else {
            return;
        };

        let close_rect = NSView::frame(&close);
        let button_height = close_rect.size.height;

        let mut title_bar_rect = NSView::frame(&title_bar_container);
        title_bar_rect.size.height = header_height;
        title_bar_rect.origin.y = window.frame().size.height - header_height;
        title_bar_container.setFrame(title_bar_rect);

        // Cocoa origin is bottom-left of the parent; center within header strip.
        let button_y = ((header_height - button_height) / 2.0).max(0.0);
        let space_between = NSView::frame(&miniaturize).origin.x - close_rect.origin.x;

        let mut buttons = vec![close, miniaturize];
        if let Some(zoom) = zoom {
            buttons.push(zoom);
        }

        for (index, button) in buttons.into_iter().enumerate() {
            let mut rect = NSView::frame(&button);
            rect.origin.x = x + (index as f64 * space_between);
            rect.origin.y = button_y;
            button.setFrameOrigin(rect.origin);
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn install(_window: &tauri::WebviewWindow) {}
