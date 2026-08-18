import type { Result } from "@praha/byethrow";

import { asWireObject, asWireString, type WireObject, type WireValue } from "@/lib/wire";

export interface CommandErrorEnvelope {
  code: string;
  message: string;
  details?: WireValue;
}

export interface CommandErrorOptions {
  cause?: unknown;
  code?: string;
  details?: WireValue;
}

export class CommandError extends Error {
  override readonly name = "CommandError";
  readonly code: string | undefined;
  readonly details: WireValue | undefined;

  constructor(message: string, options: CommandErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.code = options.code;
    this.details = options.details;
  }
}

export interface BudgetImpact {
  id: string;
  name: string;
}

const isCommandErrorEnvelope = (cause: unknown): cause is CommandErrorEnvelope => {
  const record = asWireObject(cause);
  return asWireString(record?.code) !== undefined && asWireString(record?.message) !== undefined;
};

export const commandErrorFromEnvelope = (cause: unknown): CommandError | undefined => {
  if (!isCommandErrorEnvelope(cause)) {
    return undefined;
  }

  return new CommandError(cause.message, {
    cause,
    code: cause.code,
    details: cause.details,
  });
};

export const toCommandError = (cause: unknown): CommandError => {
  if (cause instanceof CommandError) {
    return cause;
  }

  const envelopeError = commandErrorFromEnvelope(cause);
  if (envelopeError) {
    return envelopeError;
  }

  if (cause instanceof Error) {
    return new CommandError(cause.message, { cause });
  }

  return new CommandError(String(cause));
};

const parseBudgetImpact = (value: WireValue): BudgetImpact | undefined => {
  const record = asWireObject(value);
  const id = asWireString(record?.id);
  const name = asWireString(record?.name);
  if (id === undefined || name === undefined) {
    return undefined;
  }
  return { id, name };
};

export const getAffectedBudgets = (error: CommandError): Array<BudgetImpact> => {
  const details: WireObject | undefined = asWireObject(error.details);
  const budgets = details?.affectedBudgets;
  if (!Array.isArray(budgets)) {
    return [];
  }

  return budgets.flatMap((budget) => {
    const parsed = parseBudgetImpact(budget);
    return parsed === undefined ? [] : [parsed];
  });
};

export type CommandResult<T> = Result.ResultAsync<T, CommandError>;
