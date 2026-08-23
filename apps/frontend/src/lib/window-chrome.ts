import { isTauri } from "@tauri-apps/api/core";

import type { CommandBuildTarget } from "@/commands/build-target";

export interface WindowChromeAdapter {
  supportsNativeWindowChrome: boolean;
  usesCustomWindowControls: boolean;
  startDragging(): void;
  toggleMaximize(): void;
  minimize(): void;
  close(): void;
}

interface TauriWindow {
  startDragging(): Promise<void>;
  toggleMaximize(): Promise<void>;
  minimize(): Promise<void>;
  close(): Promise<void>;
}

type LoadTauriWindow = () => Promise<TauriWindow>;
type IsTauriRuntime = () => boolean;
export type WindowChromePlatform = "macos" | "windows" | "linux" | "unknown";
type DetectWindowChromePlatform = () => WindowChromePlatform;
type WindowChromeAction = "startDragging" | "toggleMaximize" | "minimize" | "close";

const DESKTOP_WINDOW_CHROME_PLATFORMS: ReadonlySet<WindowChromePlatform> = new Set([
  "macos",
  "linux",
]);
const CUSTOM_WINDOW_CONTROL_PLATFORMS: ReadonlySet<WindowChromePlatform> = new Set(["linux"]);

const loadTauriWindow: LoadTauriWindow = async () => {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
};

const createWebWindowChromeAdapter = (): WindowChromeAdapter => ({
  supportsNativeWindowChrome: false,
  usesCustomWindowControls: false,
  startDragging: () => undefined,
  toggleMaximize: () => undefined,
  minimize: () => undefined,
  close: () => undefined,
});

const detectWindowChromePlatform: DetectWindowChromePlatform = () => {
  if (globalThis.navigator === undefined) {
    return "unknown";
  }

  const platform =
    `${globalThis.navigator.platform} ${globalThis.navigator.userAgent}`.toLowerCase();
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
  const platform = getPlatform();
  if (!isTauriRuntime() || !DESKTOP_WINDOW_CHROME_PLATFORMS.has(platform)) {
    return createWebWindowChromeAdapter();
  }

  let windowPromise: Promise<TauriWindow> | undefined;

  const getWindow = () => (windowPromise ??= loadWindow());
  const invoke = (method: WindowChromeAction) => {
    void getWindow()
      .then((window) => window[method]())
      .catch(() => undefined);
  };

  return {
    supportsNativeWindowChrome: true,
    usesCustomWindowControls: CUSTOM_WINDOW_CONTROL_PLATFORMS.has(platform),
    startDragging: () => invoke("startDragging"),
    toggleMaximize: () => invoke("toggleMaximize"),
    minimize: () => invoke("minimize"),
    close: () => invoke("close"),
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
