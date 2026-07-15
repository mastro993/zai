import { CommandError } from "./errors";
import type { CommandArgs, CommandTransport } from "./types";

export const createTauriCommandTransport = (): CommandTransport => ({
  invoke: async <T>(command: string, args?: CommandArgs) => {
    if (typeof window === "undefined") {
      return Promise.reject(new CommandError("Desktop commands are only available in the client"));
    }

    const core = await import("@tauri-apps/api/core");
    const invoke = core.invoke;

    if (typeof invoke !== "function") {
      return Promise.reject(new CommandError("Tauri IPC is not available in this runtime"));
    }

    return invoke<T>(command, args);
  },
});
