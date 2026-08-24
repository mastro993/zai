//! Vertically center macOS traffic lights in the app's 48px header.
//!
//! Tauri's `trafficLightPosition.y` only expands the title-bar container
//! (`button_height + y`) and leaves button `origin.y` untouched. That is not
//! enough to center controls in a custom header, so we set frame origins
//! ourselves after the window exists.
//!
//! AppKit re-lays out the standard window buttons during live resize and
//! resets them to the title-bar origin. Re-applying from `WindowEvent::Resized`
//! happens after that frame is painted, and `setFrameOrigin` inherits the
//! live-resize animation context — lights appear to fly from `(0, 0)`. We
//! instead re-apply inside the title-bar container's `layout` (before display)
//! and suppress implicit animations.

/// Matches the frontend application title bar (`h-12` / 48px).
#[cfg(any(target_os = "macos", test))]
const HEADER_HEIGHT: f64 = 48.0;
/// Leading inset for the close button cluster.
#[cfg(any(target_os = "macos", test))]
const TRAFFIC_LIGHT_X: f64 = 16.0;
/// AppKit origin-to-origin gap between adjacent traffic lights (~12pt button + 8pt space).
#[cfg(any(target_os = "macos", test))]
const DEFAULT_TRAFFIC_LIGHT_SPACING: f64 = 20.0;

/// Native spacing if AppKit already laid buttons out; fallback when frames reset to origin.
#[cfg(any(target_os = "macos", test))]
fn resolve_traffic_light_spacing(measured: f64) -> f64 {
    if measured > 1.0 {
        measured
    } else {
        DEFAULT_TRAFFIC_LIGHT_SPACING
    }
}

#[cfg(any(target_os = "macos", test))]
fn traffic_light_button_origin(index: usize, button_height: f64, spacing: f64) -> (f64, f64) {
    let y = ((HEADER_HEIGHT - button_height) / 2.0).max(0.0);
    (TRAFFIC_LIGHT_X + index as f64 * spacing, y)
}

#[cfg(any(target_os = "macos", test))]
fn title_bar_container_origin_y(window_height: f64) -> f64 {
    window_height - HEADER_HEIGHT
}

/// Position traffic lights during AppKit layout, not after the frame is painted.
#[cfg(target_os = "macos")]
pub fn install(window: &tauri::WebviewWindow) {
    use tauri::Manager;

    patch_titlebar_layout(window);
    apply(window);

    let label = window.label().to_string();
    let app = window.app_handle().clone();
    window.on_window_event(move |event| {
        use tauri::WindowEvent;
        match event {
            WindowEvent::ScaleFactorChanged { .. } | WindowEvent::ThemeChanged(_) => {
                if let Some(win) = app.get_webview_window(&label) {
                    apply(&win);
                }
            }
            _ => {}
        }
    });
}

#[cfg(target_os = "macos")]
fn apply(window: &tauri::WebviewWindow) {
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

    inset_and_center(&ns_window);
}

#[cfg(target_os = "macos")]
fn patch_titlebar_layout(window: &tauri::WebviewWindow) {
    use objc2::rc::Retained;
    use objc2::runtime::{AnyClass, AnyObject, ClassBuilder};
    use objc2::{ffi, sel};
    use objc2_app_kit::{NSWindow, NSWindowButton};
    use std::sync::OnceLock;

    let Ok(ns_window_ptr) = window.ns_window() else {
        return;
    };
    let Some(ns_window) =
        (unsafe { Retained::retain_autoreleased(ns_window_ptr.cast::<NSWindow>()) })
    else {
        return;
    };

    unsafe {
        let Some(close) = ns_window.standardWindowButton(NSWindowButton::CloseButton) else {
            return;
        };
        let Some(close_superview) = close.superview() else {
            return;
        };
        let Some(title_bar_container) = close_superview.superview() else {
            return;
        };

        static SUBCLASS: OnceLock<&'static AnyClass> = OnceLock::new();
        let subclass = SUBCLASS.get_or_init(|| {
            let original = title_bar_container.class();
            const NAME: &std::ffi::CStr = c"ZaiTrafficLightTitlebarContainer";
            if let Some(existing) = AnyClass::get(NAME) {
                return existing;
            }
            let mut builder =
                ClassBuilder::new(NAME, original).expect("allocate titlebar layout subclass");
            builder.add_method(sel!(layout), layout as unsafe extern "C-unwind" fn(_, _));
            builder.register()
        });

        if !std::ptr::eq(title_bar_container.class(), *subclass) {
            ffi::object_setClass(
                Retained::as_ptr(&title_bar_container) as *mut AnyObject,
                *subclass,
            );
        }
    }
}

#[cfg(target_os = "macos")]
unsafe extern "C-unwind" fn layout(this: &objc2::runtime::AnyObject, _cmd: objc2::runtime::Sel) {
    use objc2::msg_send;
    use objc2::rc::Retained;
    use objc2_app_kit::NSWindow;

    let Some(superclass) = this.class().superclass() else {
        return;
    };
    let _: () = unsafe { msg_send![super(this, superclass), layout] };

    let window: Option<Retained<NSWindow>> = unsafe { msg_send![this, window] };
    if let Some(window) = window {
        inset_and_center(&window);
    }
}

#[cfg(target_os = "macos")]
fn inset_and_center(window: &objc2_app_kit::NSWindow) {
    use objc2_app_kit::{NSAnimationContext, NSView, NSWindowButton};
    use std::cell::Cell;

    thread_local! {
        static APPLYING: Cell<bool> = const { Cell::new(false) };
    }

    if APPLYING.get() {
        return;
    }
    APPLYING.set(true);

    struct ApplyGuard;
    impl Drop for ApplyGuard {
        fn drop(&mut self) {
            unsafe {
                NSAnimationContext::endGrouping();
            }
            APPLYING.set(false);
        }
    }

    // objc2 AppKit view geometry is `unsafe` because callers must keep the
    // NSWindow alive and only mutate UI on the main thread (Tauri setup / layout is).
    unsafe {
        NSAnimationContext::beginGrouping();
        let _guard = ApplyGuard;
        let context = NSAnimationContext::currentContext();
        context.setDuration(0.0);
        context.setAllowsImplicitAnimation(false);

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
        let mut title_bar_rect = NSView::frame(&title_bar_container);
        title_bar_rect.size.height = HEADER_HEIGHT;
        title_bar_rect.origin.y = title_bar_container_origin_y(window.frame().size.height);
        title_bar_container.setFrame(title_bar_rect);

        let spacing = resolve_traffic_light_spacing(
            NSView::frame(&miniaturize).origin.x - close_rect.origin.x,
        );

        let mut buttons = vec![close, miniaturize];
        if let Some(zoom) = zoom {
            buttons.push(zoom);
        }

        for (index, button) in buttons.into_iter().enumerate() {
            let mut rect = NSView::frame(&button);
            let (x, y) = traffic_light_button_origin(index, close_rect.size.height, spacing);
            rect.origin.x = x;
            rect.origin.y = y;
            button.setFrameOrigin(rect.origin);
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn install(_window: &tauri::WebviewWindow) {}

#[cfg(test)]
mod tests {
    use super::{
        resolve_traffic_light_spacing, title_bar_container_origin_y, traffic_light_button_origin,
    };

    #[test]
    fn spacing_survives_origin_reset() {
        assert_eq!(resolve_traffic_light_spacing(0.0), 20.0);
    }

    #[test]
    fn spacing_keeps_native_gap_when_buttons_already_laid_out() {
        assert_eq!(resolve_traffic_light_spacing(20.0), 20.0);
    }

    #[test]
    fn buttons_stay_spread_when_appkit_resets_frames_to_origin() {
        let spacing = resolve_traffic_light_spacing(0.0);
        assert_eq!(traffic_light_button_origin(0, 12.0, spacing), (16.0, 18.0));
        assert_eq!(traffic_light_button_origin(1, 12.0, spacing), (36.0, 18.0));
        assert_eq!(traffic_light_button_origin(2, 12.0, spacing), (56.0, 18.0));
    }

    #[test]
    fn container_stays_pinned_to_window_top() {
        assert_eq!(title_bar_container_origin_y(800.0), 752.0);
    }
}
