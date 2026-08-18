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

const isNonEmptyString = (value: string): boolean => value.length > 0;

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

export const isRevision = (value: number): boolean => isPositiveInteger(value);

export const validateIdentifier = (
  args: RecurringIdentifierArgs,
): Result.Result<RecurringIdentifierArgs, CommandError> => {
  if (!isNonEmptyString(args.recurringTransactionId)) {
    return Result.fail(new CommandError("Recurring transaction id must be a non-empty string"));
  }
  return Result.succeed({ recurringTransactionId: args.recurringTransactionId });
};

export const validateLifecycle = (
  args: LifecycleArgs,
): Result.Result<LifecycleArgs, CommandError> => {
  const identifier = validateIdentifier(args);
  if (Result.isFailure(identifier)) return identifier;
  if (!isRevision(args.expectedRevision)) {
    return Result.fail(new CommandError("Recurring revision must be a positive integer"));
  }
  return Result.succeed({ ...identifier.value, expectedRevision: args.expectedRevision });
};

export const filterQuery = (filters: RecurringFeedFilters | null | undefined) => {
  const query: Record<string, string> = {};
  if (filters?.search) {
    query.search = filters.search;
  }
  if (filters?.lifecycle) {
    query.lifecycle = filters.lifecycle;
  }
  if (filters?.needsAttention !== undefined) {
    query.needsAttention = String(filters.needsAttention);
  }
  return query;
};

export const parseLimit = (
  value: number | undefined,
  fallback: number,
): Result.Result<number, CommandError> => {
  const limit = value === undefined ? fallback : value;
  return isPositiveInteger(limit)
    ? Result.succeed(limit)
    : Result.fail(new CommandError("Recurring pagination must use a positive integer"));
};

export const parseCursor = (
  value: string | undefined,
): Result.Result<string | undefined, CommandError> => {
  if (value === undefined) return Result.succeed(undefined);
  return isNonEmptyString(value)
    ? Result.succeed(value)
    : Result.fail(new CommandError("Recurring cursor must be a non-empty string"));
};
