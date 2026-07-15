import { Result } from "@praha/byethrow";

import { CommandError } from "./errors";
import type { CommandTransport } from "./types";

export const commandBuildTargets = ["tauri", "web"] as const;

export type CommandBuildTarget = (typeof commandBuildTargets)[number];

export type CommandTransportMap = Record<CommandBuildTarget, CommandTransport>;

const expectedTargets = commandBuildTargets.join(", ");

export const parseCommandBuildTarget = (
  buildTarget: string | undefined,
): Result.Result<CommandBuildTarget, CommandError> => {
  if (buildTarget === "tauri" || buildTarget === "web") {
    return Result.succeed(buildTarget);
  }

  if (!buildTarget) {
    return Result.fail(
      new CommandError(`VITE_ZAI_BUILD_TARGET is required. Expected one of: ${expectedTargets}.`),
    );
  }

  return Result.fail(
    new CommandError(
      `Unknown VITE_ZAI_BUILD_TARGET "${buildTarget}". Expected one of: ${expectedTargets}.`,
    ),
  );
};

export const selectCommandTransport = (
  buildTarget: CommandBuildTarget,
  transports: CommandTransportMap,
): CommandTransport => transports[buildTarget];

export const resolveCommandTransport = (
  buildTarget: string | undefined,
  transports: CommandTransportMap,
): Result.Result<CommandTransport, CommandError> => {
  const targetResult = parseCommandBuildTarget(buildTarget);

  if (Result.isFailure(targetResult)) {
    return targetResult;
  }

  const transport = selectCommandTransport(targetResult.value, transports);
  if (typeof transport?.invoke !== "function") {
    return Result.fail(
      new CommandError(`Command transport is unavailable for target "${targetResult.value}".`),
    );
  }

  return Result.succeed(transport);
};
