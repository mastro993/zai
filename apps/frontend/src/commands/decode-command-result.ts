import { Result } from "@praha/byethrow";

import { CommandError, invokeCommand, type CommandArgs, type CommandResult } from "./shared";
import type { CommandDescriptor } from "./command-descriptor";

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

export const invokeDecodedCommand = async <T>(
  descriptor: CommandDescriptor<T>,
  args?: CommandArgs,
): CommandResult<T> => {
  const raw = await invokeCommand<unknown>(descriptor.name, args);
  if (Result.isFailure(raw)) {
    return raw;
  }

  return decodeCommandValue(descriptor.name, raw.value, descriptor.resultSchema);
};
