import type { CommandBuildTarget } from "@/commands/build-target";

export interface WindowChromeAdapter {
  startDragging(): void;
  toggleMaximize(): void;
}

interface TauriWindow {
  startDragging(): Promise<void>;
  toggleMaximize(): Promise<void>;
}

type LoadTauriWindow = () => Promise<TauriWindow>;

const loadTauriWindow: LoadTauriWindow = async () => {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
};

const createWebWindowChromeAdapter = (): WindowChromeAdapter => ({
  startDragging: () => undefined,
  toggleMaximize: () => undefined,
});

export const createTauriWindowChromeAdapter = (
  loadWindow: LoadTauriWindow = loadTauriWindow,
): WindowChromeAdapter => {
  let windowPromise: Promise<TauriWindow> | undefined;

  const getWindow = () => (windowPromise ??= loadWindow());
  const invoke = (method: "startDragging" | "toggleMaximize") => {
    void getWindow()
      .then((window) => window[method]())
      .catch(() => undefined);
  };

  return {
    startDragging: () => invoke("startDragging"),
    toggleMaximize: () => invoke("toggleMaximize"),
  };
};

export const createWindowChromeAdapter = (
  buildTarget: CommandBuildTarget,
  loadWindow?: LoadTauriWindow,
): WindowChromeAdapter =>
  buildTarget === "tauri"
    ? createTauriWindowChromeAdapter(loadWindow)
    : createWebWindowChromeAdapter();
