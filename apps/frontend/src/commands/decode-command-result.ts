import { Result } from "@praha/byethrow";

import type { CommandDescriptor } from "./command-descriptor";
import { CommandError } from "./errors";

export const decodeCommandValue = <T>(
  command: string,
  value: unknown,
  resultSchema: CommandDescriptor<T>["resultSchema"],
): Result.Result<T, CommandError> => {
  if (resultSchema === "void") {
    return Result.succeed(undefined as T) as Result.Result<T, CommandError>;
  }

  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) {
    return Result.fail(
      new CommandError(`Invalid response for ${command}`, {
        details: parsed.error.flatten(),
      }),
    );
  }

  return Result.succeed(parsed.data as T) as Result.Result<T, CommandError>;
};
