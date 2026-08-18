import { hasWindow } from "@/lib/runtime-globals";
import { isCallable } from "@/lib/wire";

import { CommandError } from "./errors";
import type { CommandDescriptor } from "./command-descriptor";
import type { CommandTransport } from "./types";

export const createTauriCommandTransport = (): CommandTransport => ({
  invoke: async <TArgs, TResult>(descriptor: CommandDescriptor<TArgs, TResult>, args: TArgs) => {
    if (!hasWindow()) {
      return Promise.reject(new CommandError("Desktop commands are only available in the client"));
    }

    const core = await import("@tauri-apps/api/core");
    const invoke = core.invoke;

    if (!isCallable(core.isTauri) || !core.isTauri() || !isCallable(invoke)) {
      return Promise.reject(new CommandError("Tauri IPC is not available in this runtime"));
    }

    return args === undefined
      ? invoke<TResult>(descriptor.name)
      : // SAFETY: Tauri invoke records args as a generic payload; descriptor TArgs is the
        // owner contract for this command and is serialized as-is.
        invoke<TResult>(descriptor.name, args as never);
  },
});
