import { Result } from "@praha/byethrow";

import { resolveCommandTransport, type CommandTransportMap } from "./build-target";
import type { CommandDescriptor } from "./command-descriptor";
import { CommandError, toCommandError, type CommandResult } from "./errors";
import { createTauriCommandTransport } from "./tauri-transport";
import { createWebCommandTransport } from "./web-transport";

let commandTransports: CommandTransportMap | undefined;

const getCommandTransports = (): CommandTransportMap => {
  commandTransports ??= {
    tauri: createTauriCommandTransport(),
    web: createWebCommandTransport(),
  };

  return commandTransports;
};

const invokeTransport = <TArgs, TResult>(
  descriptor: CommandDescriptor<TArgs, TResult>,
  args: TArgs,
): CommandResult<TResult> => {
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
    try: () => transport.invoke(descriptor, args),
    catch: toCommandError,
  });
};

export function invokeDecodedCommand<TResult>(
  descriptor: CommandDescriptor<void, TResult>,
): CommandResult<TResult>;

export function invokeDecodedCommand<TArgs, TResult>(
  descriptor: CommandDescriptor<TArgs, TResult>,
  args: TArgs,
): CommandResult<TResult>;

export async function invokeDecodedCommand<TArgs, TResult>(
  descriptor: CommandDescriptor<TArgs, TResult>,
  args?: TArgs,
): CommandResult<TResult> {
  const raw = await invokeTransport(descriptor, args as TArgs);
  if (Result.isFailure(raw)) {
    return raw;
  }

  const { decodeCommandValue } = await import("./decode-command-result");
  return decodeCommandValue(descriptor.name, raw.value, descriptor.resultSchema);
}

export { CommandError, toCommandError };
export type { CommandResult };
