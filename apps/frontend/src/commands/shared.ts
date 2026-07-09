import { Result } from "@praha/byethrow";

import { resolveCommandTransport, type CommandTransportMap } from "./build-target";
import { CommandError, toCommandError, type CommandResult } from "./errors";
import { createTauriCommandTransport } from "./tauri-transport";
import type { CommandArgs } from "./types";
import { createWebCommandTransport } from "./web-transport";

const commandTransports: CommandTransportMap = {
  tauri: createTauriCommandTransport(),
  web: createWebCommandTransport(),
};

export const invokeCommand = <T>(command: string, args?: CommandArgs): CommandResult<T> => {
  const transportResult = resolveCommandTransport(
    import.meta.env.VITE_ZAI_BUILD_TARGET,
    commandTransports,
  );

  if (Result.isFailure(transportResult)) {
    return Promise.resolve(Result.fail(transportResult.error));
  }

  return Result.try({
    try: () => transportResult.value.invoke<T>(command, args),
    catch: toCommandError,
  });
};

export { CommandError, toCommandError };
export type { CommandArgs, CommandResult };
