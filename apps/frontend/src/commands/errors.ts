import type { Result } from "@praha/byethrow";

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
