import { CommandError } from "./errors";
import type { CommandArgs, CommandTransport } from "./types";

export const createTauriCommandTransport = (): CommandTransport => ({
  invoke: async <T>(command: string, args?: CommandArgs) => {
    if (typeof window === "undefined") {
      return Promise.reject(new CommandError("Desktop commands are only available in the client"));
    }

    const { invoke } = await import("@tauri-apps/api/core");

    return invoke<T>(command, args);
  },
});
