import { Result } from "@praha/byethrow";
import type { z } from "zod";

import { wireValueSchema } from "@/lib/wire";

import { CommandError } from "./errors";

export function decodeCommandValue(
  command: string,
  value: null | undefined,
  resultSchema: "void",
): Result.Result<void, CommandError>;
export function decodeCommandValue<T, TRaw>(
  command: string,
  value: TRaw,
  resultSchema: z.ZodType<T>,
): Result.Result<T, CommandError>;
export function decodeCommandValue<T, TRaw>(
  command: string,
  value: TRaw,
  resultSchema: z.ZodType<T> | "void",
): Result.Result<T | void, CommandError> {
  if (resultSchema === "void") {
    return Result.succeed(undefined);
  }

  const parsed = resultSchema.safeParse(value);
  if (!parsed.success) {
    const flatten = parsed.error.flatten();
    const details = wireValueSchema.safeParse(flatten);
    return Result.fail(
      new CommandError(`Invalid response for ${command}`, {
        details: details.success ? details.data : null,
      }),
    );
  }

  // SAFETY: Zod parse already produced T. byethrow Result.succeed widens thenables
  // into ResultAsync; command payloads are never thenables at this boundary.
  return Result.succeed(parsed.data) as Result.Result<T, CommandError>;
}
