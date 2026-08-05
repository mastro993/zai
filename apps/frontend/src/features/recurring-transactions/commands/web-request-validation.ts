import { Result } from "@praha/byethrow";

import { CommandError } from "@/commands/errors";

import type { RecurringBulkAction, RecurringBulkItem } from "../types/recurring-bulk";
import type {
  RecurringFeedFilters,
  RecurringRepairField,
  ScheduleRule,
} from "../types/recurring-transaction";

export interface RecurringFeedArgs {
  limit?: number;
  cursor?: string;
  filters?: RecurringFeedFilters | null;
}
export interface RecurringIdentifierArgs {
  recurringTransactionId: string;
}
export interface OccurrencesArgs extends RecurringIdentifierArgs {
  limit?: number;
  cursor?: string;
}
export interface ProjectionArgs {
  horizonMonths?: number;
  includePausedBudgets?: boolean;
  focusRecurringTransactionId?: string;
}
export interface ProvenanceArgs {
  transactionId: string;
}
export interface RecurringTemplate {
  description: string;
  amount: number;
  transactionType: string;
  transactionCategoryId?: string | null;
  notes?: string | null;
}
export interface NewRecurringTransaction {
  schedule: ScheduleRule;
  firstScheduledLocal: string;
  totalOccurrences: number | null;
  template: RecurringTemplate;
}
export interface CreateRecurringArgs {
  newRecurringTransaction: NewRecurringTransaction;
}
export interface AdoptionRequest {
  transactionId: string;
  expectedTransactionDate: string;
  schedule: ScheduleRule;
  totalOccurrences: number | null;
  template: RecurringTemplate;
}
export interface AdoptionPreviewRequest {
  transactionId: string;
  schedule: ScheduleRule;
  totalOccurrences: number | null;
}
export interface AdoptionArgs {
  request: AdoptionRequest;
}
export interface AdoptionPreviewArgs {
  request: AdoptionPreviewRequest;
}
export interface UpdateRecurringInput {
  recurringTransactionId: string;
  expectedRevision: number;
  schedule: ScheduleRule;
  nextScheduledLocal: string;
  totalOccurrences: number | null;
  template: RecurringTemplate;
}
export interface UpdateRecurringArgs {
  input: UpdateRecurringInput;
}
export interface LifecycleArgs extends RecurringIdentifierArgs {
  expectedRevision: number;
}
export interface FailureHistoryArgs extends RecurringIdentifierArgs {
  limit?: number;
  cursor?: string;
}
export interface RepairRequest {
  recurringTransactionId: string;
  expectedRevision: number;
  repairFieldKey: RecurringRepairField;
  template: RecurringTemplate;
}
export interface PreviewRepairArgs {
  request: RepairRequest;
}
export interface RepairArgs {
  input: RepairRequest;
}
export interface RetryArgs {
  input: { recurringTransactionId: string; expectedRevision: number };
}
export interface MatchingIdsArgs {
  filters?: RecurringFeedFilters | null;
}
export interface BulkArgs {
  request: { action: RecurringBulkAction; items: Array<RecurringBulkItem> };
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;
export const isRevision = (value: unknown): value is number => isPositiveInteger(value);

export const validateIdentifier = (
  args: unknown,
): Result.Result<RecurringIdentifierArgs, CommandError> => {
  if (!isRecord(args) || !isNonEmptyString(args.recurringTransactionId)) {
    return Result.fail(new CommandError("Recurring transaction id must be a non-empty string"));
  }
  return Result.succeed({ recurringTransactionId: args.recurringTransactionId });
};

export const validateLifecycle = (args: unknown): Result.Result<LifecycleArgs, CommandError> => {
  const identifier = validateIdentifier(args);
  if (Result.isFailure(identifier)) return identifier;
  if (!isRecord(args) || !isRevision(args.expectedRevision)) {
    return Result.fail(new CommandError("Recurring revision must be a positive integer"));
  }
  return Result.succeed({ ...identifier.value, expectedRevision: args.expectedRevision });
};

export const validateFilters = (
  value: unknown,
): Result.Result<RecurringFeedFilters | null | undefined, CommandError> => {
  if (value === undefined || value === null) return Result.succeed(value);
  if (!isRecord(value))
    return Result.fail(new CommandError("Recurring filters must be a record or null"));
  if (value.search !== undefined && typeof value.search !== "string") {
    return Result.fail(new CommandError("Recurring search must be a string"));
  }
  if (value.lifecycle !== undefined && typeof value.lifecycle !== "string") {
    return Result.fail(new CommandError("Recurring lifecycle must be a string"));
  }
  if (value.needsAttention !== undefined && typeof value.needsAttention !== "boolean") {
    return Result.fail(new CommandError("Recurring attention filter must be boolean"));
  }
  return Result.succeed(value as RecurringFeedFilters);
};

export const filterQuery = (
  filters: RecurringFeedFilters | null | undefined,
): Record<string, string> => ({
  ...(filters?.search ? { search: filters.search } : {}),
  ...(filters?.lifecycle ? { lifecycle: filters.lifecycle } : {}),
  ...(typeof filters?.needsAttention === "boolean"
    ? { needsAttention: String(filters.needsAttention) }
    : {}),
});

export const parseLimit = (
  value: unknown,
  fallback: number,
): Result.Result<number, CommandError> => {
  const limit = value === undefined ? fallback : value;
  return isPositiveInteger(limit)
    ? Result.succeed(limit)
    : Result.fail(new CommandError("Recurring pagination must use a positive integer"));
};

export const parseCursor = (value: unknown): Result.Result<string | undefined, CommandError> => {
  if (value === undefined) return Result.succeed(undefined);
  return isNonEmptyString(value)
    ? Result.succeed(value)
    : Result.fail(new CommandError("Recurring cursor must be a non-empty string"));
};
