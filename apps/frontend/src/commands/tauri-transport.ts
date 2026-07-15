import { CommandError } from "./errors";
import type { CommandArgs, CommandTransport } from "./types";

type TauriInternals = {
  invoke: <T>(command: string, args?: CommandArgs) => Promise<T>;
};

const readTauriInternals = (): TauriInternals | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const internals = (window as Window & { __TAURI_INTERNALS__?: TauriInternals })
    .__TAURI_INTERNALS__;

  if (!internals || typeof internals.invoke !== "function") {
    return undefined;
  }

  return internals;
};

export const createTauriCommandTransport = (): CommandTransport => ({
  invoke: async <T>(command: string, args?: CommandArgs) => {
    if (typeof window === "undefined") {
      return Promise.reject(new CommandError("Desktop commands are only available in the client"));
    }

    const { invoke, isTauri } = await import("@tauri-apps/api/core");

    if (!isTauri() || !readTauriInternals()) {
      return Promise.reject(
        new CommandError(
          "Tauri IPC is not available. Use the Zai desktop window — not a browser tab on :1420.",
        ),
      );
    }

    if (typeof invoke !== "function") {
      return Promise.reject(new CommandError("Tauri IPC is not available in this runtime"));
    }

    return invoke<T>(command, args);
  },
});
