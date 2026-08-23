# Use Linux client-side chrome matching the macOS overlay header

Zai will hide native GTK/window-manager decorations on Linux Tauri and use the same 48px application header as macOS. Custom close/minimize/maximize controls sit in the traffic-light slot on the left; drag regions and double-click maximize stay on the shared header and sidebar strip.

macOS keeps native overlay decorations and traffic lights (ADR 0003). Windows keeps native decorations until a dedicated chrome is designed. Web builds are unchanged. JSON Merge Patch replaces the `windows` array, so `tauri.linux.conf.json` copies the main window object and only changes `decorations`. Runtime `set_decorations(false)` is a fallback if the platform config is skipped.
