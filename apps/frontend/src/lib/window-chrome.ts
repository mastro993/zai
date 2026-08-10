import { isTauri } from "@tauri-apps/api/core";

import type { CommandBuildTarget } from "@/commands/build-target";

export interface WindowChromeAdapter {
  supportsNativeWindowChrome: boolean;
  startDragging(): void;
  toggleMaximize(): void;
}

interface TauriWindow {
  startDragging(): Promise<void>;
  toggleMaximize(): Promise<void>;
}

type LoadTauriWindow = () => Promise<TauriWindow>;
type IsTauriRuntime = () => boolean;
export type WindowChromePlatform = "macos" | "windows" | "linux" | "unknown";
type DetectWindowChromePlatform = () => WindowChromePlatform;

const loadTauriWindow: LoadTauriWindow = async () => {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
};

const createWebWindowChromeAdapter = (): WindowChromeAdapter => ({
  supportsNativeWindowChrome: false,
  startDragging: () => undefined,
  toggleMaximize: () => undefined,
});

const detectWindowChromePlatform: DetectWindowChromePlatform = () => {
  if (typeof navigator === "undefined") {
    return "unknown";
  }

  const platform = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (platform.includes("mac")) {
    return "macos";
  }

  if (platform.includes("win")) {
    return "windows";
  }

  if (platform.includes("linux")) {
    return "linux";
  }

  return "unknown";
};

export const createTauriWindowChromeAdapter = (
  loadWindow: LoadTauriWindow = loadTauriWindow,
  isTauriRuntime: IsTauriRuntime = isTauri,
  getPlatform: DetectWindowChromePlatform = detectWindowChromePlatform,
): WindowChromeAdapter => {
  if (!isTauriRuntime() || getPlatform() !== "macos") {
    return createWebWindowChromeAdapter();
  }

  let windowPromise: Promise<TauriWindow> | undefined;

  const getWindow = () => (windowPromise ??= loadWindow());
  const invoke = (method: "startDragging" | "toggleMaximize") => {
    void getWindow()
      .then((window) => window[method]())
      .catch(() => undefined);
  };

  return {
    supportsNativeWindowChrome: true,
    startDragging: () => invoke("startDragging"),
    toggleMaximize: () => invoke("toggleMaximize"),
  };
};

export const createWindowChromeAdapter = (
  buildTarget: CommandBuildTarget,
  loadWindow?: LoadTauriWindow,
  isTauriRuntime?: IsTauriRuntime,
  getPlatform?: DetectWindowChromePlatform,
): WindowChromeAdapter =>
  buildTarget === "tauri"
    ? createTauriWindowChromeAdapter(loadWindow, isTauriRuntime, getPlatform)
    : createWebWindowChromeAdapter();
