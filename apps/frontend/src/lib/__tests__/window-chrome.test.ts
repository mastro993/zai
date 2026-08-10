import { describe, expect, it, vi } from "vitest";

import { createTauriWindowChromeAdapter, createWindowChromeAdapter } from "../window-chrome";

describe("window chrome adapter", () => {
  it("keeps web builds native-window free", () => {
    const loadWindow = vi.fn();
    const adapter = createWindowChromeAdapter("web", loadWindow);

    adapter.startDragging();
    adapter.toggleMaximize();

    expect(loadWindow).not.toHaveBeenCalled();
  });

  it("keeps Tauri window APIs unloaded until runtime is confirmed", async () => {
    const loadWindow = vi.fn();
    const adapter = createWindowChromeAdapter("tauri", loadWindow, () => false);

    adapter.startDragging();
    adapter.toggleMaximize();
    await Promise.resolve();

    expect(loadWindow).not.toHaveBeenCalled();
  });

  it("leaves unsupported desktop platform controls unimplemented", async () => {
    const loadWindow = vi.fn();
    const adapter = createWindowChromeAdapter(
      "tauri",
      loadWindow,
      () => true,
      () => "windows",
    );

    adapter.startDragging();
    adapter.toggleMaximize();
    await Promise.resolve();

    expect(adapter.supportsNativeWindowChrome).toBe(false);
    expect(loadWindow).not.toHaveBeenCalled();
  });

  it("loads the Tauri window lazily and reuses it for approved actions", async () => {
    const startDragging = vi.fn(() => Promise.resolve());
    const toggleMaximize = vi.fn(() => Promise.resolve());
    const loadWindow = vi.fn(() => Promise.resolve({ startDragging, toggleMaximize }));
    const adapter = createTauriWindowChromeAdapter(
      loadWindow,
      () => true,
      () => "macos",
    );

    adapter.startDragging();
    adapter.toggleMaximize();
    await Promise.resolve();

    expect(loadWindow).toHaveBeenCalledTimes(1);
    expect(startDragging).toHaveBeenCalledTimes(1);
    expect(toggleMaximize).toHaveBeenCalledTimes(1);
  });
});
