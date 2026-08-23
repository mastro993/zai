import { describe, expect, it, vi } from "vitest";

import { createTauriWindowChromeAdapter, createWindowChromeAdapter } from "../window-chrome";

const createWindow = () => ({
  startDragging: vi.fn(() => Promise.resolve()),
  toggleMaximize: vi.fn(() => Promise.resolve()),
  minimize: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
});

describe("window chrome adapter", () => {
  it("keeps web builds native-window free", () => {
    const loadWindow = vi.fn();
    const adapter = createWindowChromeAdapter("web", loadWindow);

    adapter.startDragging();
    adapter.toggleMaximize();
    adapter.minimize();
    adapter.close();

    expect(adapter.supportsNativeWindowChrome).toBe(false);
    expect(adapter.usesCustomWindowControls).toBe(false);
    expect(loadWindow).not.toHaveBeenCalled();
  });

  it("keeps Tauri window APIs unloaded until runtime is confirmed", async () => {
    const loadWindow = vi.fn();
    const adapter = createWindowChromeAdapter("tauri", loadWindow, () => false);

    adapter.startDragging();
    adapter.toggleMaximize();
    adapter.minimize();
    adapter.close();
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
    adapter.minimize();
    adapter.close();
    await Promise.resolve();

    expect(adapter.supportsNativeWindowChrome).toBe(false);
    expect(adapter.usesCustomWindowControls).toBe(false);
    expect(loadWindow).not.toHaveBeenCalled();
  });

  it("loads the Tauri window lazily and reuses it for approved macOS actions", async () => {
    const window = createWindow();
    const loadWindow = vi.fn(() => Promise.resolve(window));
    const adapter = createTauriWindowChromeAdapter(
      loadWindow,
      () => true,
      () => "macos",
    );

    adapter.startDragging();
    adapter.toggleMaximize();
    adapter.minimize();
    adapter.close();
    await Promise.resolve();

    expect(adapter.supportsNativeWindowChrome).toBe(true);
    expect(adapter.usesCustomWindowControls).toBe(false);
    expect(loadWindow).toHaveBeenCalledTimes(1);
    expect(window.startDragging).toHaveBeenCalledTimes(1);
    expect(window.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(window.minimize).toHaveBeenCalledTimes(1);
    expect(window.close).toHaveBeenCalledTimes(1);
  });

  it("enables Linux client-side chrome including custom window controls", async () => {
    const window = createWindow();
    const loadWindow = vi.fn(() => Promise.resolve(window));
    const adapter = createWindowChromeAdapter(
      "tauri",
      loadWindow,
      () => true,
      () => "linux",
    );

    adapter.startDragging();
    adapter.toggleMaximize();
    adapter.minimize();
    adapter.close();
    await Promise.resolve();

    expect(adapter.supportsNativeWindowChrome).toBe(true);
    expect(adapter.usesCustomWindowControls).toBe(true);
    expect(loadWindow).toHaveBeenCalledTimes(1);
    expect(window.startDragging).toHaveBeenCalledTimes(1);
    expect(window.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(window.minimize).toHaveBeenCalledTimes(1);
    expect(window.close).toHaveBeenCalledTimes(1);
  });
});
