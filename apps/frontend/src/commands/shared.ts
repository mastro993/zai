import { Result } from "@praha/byethrow";

type CommandArgs = Record<string, unknown>;

export class CommandError extends Error {
  override readonly name = "CommandError";
}

export const toCommandError = (error: unknown): CommandError => {
  if (error instanceof CommandError) {
    return error;
  }

  if (error instanceof Error) {
    return new CommandError(error.message, { cause: error });
  }

  return new CommandError(String(error));
};

export type CommandResult<T> = Result.ResultAsync<T, CommandError>;

export const invokeCommand = <T>(command: string, args?: CommandArgs): CommandResult<T> => {
  if (typeof window === "undefined") {
    return Promise.resolve(
      Result.fail(new CommandError("Desktop commands are only available in the client")),
    );
  }

  return Result.try({
    try: () => import("@tauri-apps/api/core").then(({ invoke }) => invoke<T>(command, args)),
    catch: toCommandError,
  });
};
