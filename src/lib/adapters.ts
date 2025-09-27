import { invoke } from "@tauri-apps/api/core";
import { error, info, warn, trace, debug } from "@tauri-apps/plugin-log";

export enum RUN_ENV {
  DESKTOP = "desktop",
  MOBILE = "mobile",
  BROWSER = "browser",
  UNSUPPORTED = "unsupported",
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __TAURI__?: any;
  }
}

export const getRunEnv = (): RUN_ENV => {
  if (typeof window !== "undefined" && window.__TAURI__) {
    return RUN_ENV.DESKTOP;
  }
  if (typeof window !== "undefined" && window.indexedDB) {
    return RUN_ENV.BROWSER;
  }
  return RUN_ENV.UNSUPPORTED;
};

export const invokeTauri = async <T>(
  command: string,
  payload?: Record<string, unknown>
) => {
  return await invoke<T>(command, payload);
};

export const logger = {
  error,
  info,
  warn,
  trace,
  debug,
};
