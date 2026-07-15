import { Result } from "@praha/byethrow";

import { resolveCommandTransport, type CommandTransportMap } from "./build-target";
import type { CommandDescriptor } from "./command-descriptor";
import { CommandError, toCommandError, type CommandResult } from "./errors";
import { createTauriCommandTransport } from "./tauri-transport";
import type { CommandArgs } from "./types";
import { createWebCommandTransport } from "./web-transport";

let commandTransports: CommandTransportMap | undefined;

const getCommandTransports = (): CommandTransportMap => {
  commandTransports ??= {
    tauri: createTauriCommandTransport(),
    web: createWebCommandTransport(),
  };

  return commandTransports;
};

export const invokeCommand = <T>(command: string, args?: CommandArgs): CommandResult<T> => {
  const transportResult = resolveCommandTransport(
    import.meta.env.VITE_ZAI_BUILD_TARGET,
    getCommandTransports(),
  );

  if (Result.isFailure(transportResult)) {
    return Promise.resolve(Result.fail(transportResult.error));
  }

  const transport = transportResult.value;
  if (!transport?.invoke) {
    return Promise.resolve(
      Result.fail(
        new CommandError(
          `Command transport is unavailable for target "${import.meta.env.VITE_ZAI_BUILD_TARGET}".`,
        ),
      ),
    );
  }

  return Result.try({
    try: () => transport.invoke<T>(command, args),
    catch: toCommandError,
  });
};

export const invokeDecodedCommand = async <T>(
  descriptor: CommandDescriptor<T>,
  args?: CommandArgs,
): CommandResult<T> => {
  const raw = await invokeCommand<unknown>(descriptor.name, args);
  if (Result.isFailure(raw)) {
    return raw;
  }

  const { decodeCommandValue } = await import("./decode-command-result");
  return decodeCommandValue(descriptor.name, raw.value, descriptor.resultSchema);
};

export { CommandError, toCommandError };
export type { CommandArgs, CommandResult };
