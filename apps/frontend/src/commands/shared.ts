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

export const setCommandTransports = (transports: CommandTransportMap): void => {
  commandTransports = transports;
};

export const resetCommandTransports = (): void => {
  commandTransports = undefined;
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
  // SAFETY: overload requires args only when TArgs is not void; the matching
  // public signatures enforce that callers pass the descriptor's argument type.
  const raw = await invokeTransport(descriptor, args as TArgs);
  if (Result.isFailure(raw)) {
    return raw;
  }

  const { decodeCommandValue } = await import("./decode-command-result");
  if (descriptor.resultSchema === "void") {
    // SAFETY: void descriptors have no payload; TResult is void for those commands.
    return Promise.resolve(
      decodeCommandValue(descriptor.name, null, "void"),
    ) as CommandResult<TResult>;
  }
  return Promise.resolve(decodeCommandValue(descriptor.name, raw.value, descriptor.resultSchema));
}

export { CommandError, toCommandError };
export type { CommandResult };
