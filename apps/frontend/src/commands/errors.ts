import type { Result } from "@praha/byethrow";

export interface CommandErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
}

export interface CommandErrorOptions {
  cause?: unknown;
  code?: string;
  details?: unknown;
}

export class CommandError extends Error {
  override readonly name = "CommandError";
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(message: string, options: CommandErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.code = options.code;
    this.details = options.details;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCommandErrorEnvelope = (value: unknown): value is CommandErrorEnvelope =>
  isRecord(value) && typeof value.code === "string" && typeof value.message === "string";

export const commandErrorFromEnvelope = (error: unknown): CommandError | undefined => {
  if (!isCommandErrorEnvelope(error)) {
    return undefined;
  }

  return new CommandError(error.message, {
    cause: error,
    code: error.code,
    details: error.details,
  });
};

export const toCommandError = (error: unknown): CommandError => {
  if (error instanceof CommandError) {
    return error;
  }

  const envelopeError = commandErrorFromEnvelope(error);
  if (envelopeError) {
    return envelopeError;
  }

  if (error instanceof Error) {
    return new CommandError(error.message, { cause: error });
  }

  return new CommandError(String(error));
};

export type CommandResult<T> = Result.ResultAsync<T, CommandError>;
