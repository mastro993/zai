import { CommandError } from "./errors";
import type { CommandDescriptor } from "./command-descriptor";
import type { CommandTransport } from "./types";

export const createTauriCommandTransport = (): CommandTransport => ({
  invoke: async <TArgs, TResult>(descriptor: CommandDescriptor<TArgs, TResult>, args: TArgs) => {
    if (typeof window === "undefined") {
      return Promise.reject(new CommandError("Desktop commands are only available in the client"));
    }

    const core = await import("@tauri-apps/api/core");
    const invoke = core.invoke;

    if (typeof core.isTauri !== "function" || !core.isTauri() || typeof invoke !== "function") {
      return Promise.reject(new CommandError("Tauri IPC is not available in this runtime"));
    }

    return args === undefined
      ? invoke<TResult>(descriptor.name)
      : invoke<TResult>(descriptor.name, args as never);
  },
});
