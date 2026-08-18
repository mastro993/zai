import { Result } from "@praha/byethrow";

import { CommandError } from "@/commands/errors";
import type { WebRequestSpec } from "@/commands/web-request-spec";

import type {
  AdoptionArgs,
  AdoptionPreviewArgs,
  BulkArgs,
  CreateRecurringArgs,
  FailureHistoryArgs,
  LifecycleArgs,
  MatchingIdsArgs,
  OccurrencesArgs,
  PreviewRepairArgs,
  ProjectionArgs,
  ProvenanceArgs,
  RecurringFeedArgs,
  RecurringIdentifierArgs,
  RepairArgs,
  RepairRequest,
  RetryArgs,
  UpdateRecurringArgs,
} from "./web-request-validation";
import {
  filterQuery,
  isRevision,
  parseCursor,
  parseLimit,
  validateIdentifier,
  validateLifecycle,
} from "./web-request-validation";

const isNonEmptyString = (value: string): boolean => value.length > 0;

const listQuery = (
  limit: number,
  cursor: string | undefined,
  extra?: RecurringFeedArgs["filters"],
) => {
  const query = filterQuery(extra);
  query.limit = String(limit);
  if (cursor) {
    query.cursor = cursor;
  }
  return query;
};

export const buildGetRecurringTransactionsRequest = (
  args: RecurringFeedArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const limit = parseLimit(args.limit, 50);
  if (Result.isFailure(limit)) return limit;
  const cursor = parseCursor(args.cursor);
  if (Result.isFailure(cursor)) return cursor;
  return Result.succeed({
    method: "GET",
    path: "/recurring-transactions",
    query: listQuery(limit.value, cursor.value, args.filters),
  });
};

export const buildGetRecurringTransactionRequest = (
  args: RecurringIdentifierArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const validArgs = validateIdentifier(args);
  return Result.isFailure(validArgs)
    ? validArgs
    : Result.succeed({
        method: "GET",
        path: `/recurring-transactions/${validArgs.value.recurringTransactionId}`,
      });
};

export const buildGetRecurringOccurrencesRequest = (
  args: OccurrencesArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const identifier = validateIdentifier(args);
  if (Result.isFailure(identifier)) return identifier;
  const limit = parseLimit(args.limit, 50);
  if (Result.isFailure(limit)) return limit;
  const cursor = parseCursor(args.cursor);
  if (Result.isFailure(cursor)) return cursor;
  return Result.succeed({
    method: "GET",
    path: `/recurring-transactions/${identifier.value.recurringTransactionId}/occurrences`,
    query: listQuery(limit.value, cursor.value),
  });
};

export const buildGetRecurringProjectionsRequest = (
  args: ProjectionArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const horizon = parseLimit(args.horizonMonths, 3);
  if (Result.isFailure(horizon)) return horizon;
  if (
    args.focusRecurringTransactionId !== undefined &&
    !isNonEmptyString(args.focusRecurringTransactionId)
  ) {
    return Result.fail(new CommandError("Projection focus id must be a non-empty string"));
  }
  const query: Record<string, string> = {};
  query.horizonMonths = String(horizon.value);
  query.includePausedBudgets = String(args.includePausedBudgets === true);
  if (args.focusRecurringTransactionId) {
    query.focusRecurringTransactionId = args.focusRecurringTransactionId;
  }
  return Result.succeed({
    method: "GET",
    path: "/recurring-transactions/budget-projections",
    query,
  });
};

export const buildGetRecurringProcessingStatusRequest = (
  _args: void,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({ method: "GET", path: "/recurring-processing/status" });

export const buildGetTransactionProvenanceRequest = (
  args: ProvenanceArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isNonEmptyString(args.transactionId)) {
    return Result.fail(new CommandError("Transaction id must be a non-empty string"));
  }
  return Result.succeed({
    method: "GET",
    path: `/recurring-transactions/provenance/${args.transactionId}`,
  });
};

export const buildCreateRecurringTransactionRequest = (
  args: CreateRecurringArgs,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({
    method: "POST",
    path: "/recurring-transactions",
    body: args.newRecurringTransaction,
  });

export const buildUpdateRecurringTransactionRequest = (
  args: UpdateRecurringArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (
    !isNonEmptyString(args.input.recurringTransactionId) ||
    !isRevision(args.input.expectedRevision)
  ) {
    return Result.fail(new CommandError("Recurring update requires id and revision"));
  }
  return Result.succeed({
    method: "POST",
    path: `/recurring-transactions/${args.input.recurringTransactionId}`,
    body: args.input,
  });
};

export const buildAdoptRecurringTransactionRequest = (
  args: AdoptionArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isNonEmptyString(args.request.transactionId)) {
    return Result.fail(new CommandError("Adoption transaction id must be a non-empty string"));
  }
  if (!isNonEmptyString(args.request.expectedTransactionDate)) {
    return Result.fail(new CommandError("Adoption expected transaction date must be provided"));
  }
  return Result.succeed({
    method: "POST",
    path: "/recurring-transactions/adopt",
    body: args.request,
  });
};

export const buildPreviewRecurringAdoptionRequest = (
  args: AdoptionPreviewArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isNonEmptyString(args.request.transactionId)) {
    return Result.fail(new CommandError("Adoption transaction id must be a non-empty string"));
  }
  const { transactionId, schedule, totalOccurrences } = args.request;
  return Result.succeed({
    method: "POST",
    path: "/recurring-transactions/adoption-preview",
    body: { transactionId, schedule, totalOccurrences },
  });
};

const buildRecurringLifecycleRequest = (
  args: LifecycleArgs,
  action: "pause" | "resume" | "stop" | "delete",
): Result.Result<WebRequestSpec, CommandError> => {
  const valid = validateLifecycle(args);
  if (Result.isFailure(valid)) return valid;
  return Result.succeed({
    method: "POST",
    path: `/recurring-transactions/${valid.value.recurringTransactionId}/${action}`,
    body: { expectedRevision: valid.value.expectedRevision },
  });
};

export const buildPauseRecurringTransactionRequest = (
  args: LifecycleArgs,
): Result.Result<WebRequestSpec, CommandError> => buildRecurringLifecycleRequest(args, "pause");
export const buildResumeRecurringTransactionRequest = (
  args: LifecycleArgs,
): Result.Result<WebRequestSpec, CommandError> => buildRecurringLifecycleRequest(args, "resume");
export const buildStopRecurringTransactionRequest = (
  args: LifecycleArgs,
): Result.Result<WebRequestSpec, CommandError> => buildRecurringLifecycleRequest(args, "stop");
export const buildDeleteRecurringTransactionRequest = (
  args: LifecycleArgs,
): Result.Result<WebRequestSpec, CommandError> => buildRecurringLifecycleRequest(args, "delete");

export const buildGetRecurringFailureHistoryRequest = (
  args: FailureHistoryArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const identifier = validateIdentifier(args);
  if (Result.isFailure(identifier)) return identifier;
  const limit = parseLimit(args.limit, 20);
  if (Result.isFailure(limit)) return limit;
  const cursor = parseCursor(args.cursor);
  if (Result.isFailure(cursor)) return cursor;
  return Result.succeed({
    method: "GET",
    path: `/recurring-transactions/${identifier.value.recurringTransactionId}/failures`,
    query: listQuery(limit.value, cursor.value),
  });
};

const buildRecurringIdentifierRequest = (
  args: RecurringIdentifierArgs,
  suffix: string,
): Result.Result<WebRequestSpec, CommandError> => {
  const valid = validateIdentifier(args);
  return Result.isFailure(valid)
    ? valid
    : Result.succeed({
        method: "GET",
        path: `/recurring-transactions/${valid.value.recurringTransactionId}/${suffix}`,
      });
};

export const buildGetRecurringDiagnosticsRequest = (
  args: RecurringIdentifierArgs,
): Result.Result<WebRequestSpec, CommandError> =>
  buildRecurringIdentifierRequest(args, "diagnostics");

const validateRepair = (value: RepairRequest): Result.Result<RepairRequest, CommandError> => {
  if (!isNonEmptyString(value.recurringTransactionId) || !isRevision(value.expectedRevision)) {
    return Result.fail(new CommandError("Recurring repair requires id, revision, and template"));
  }
  return Result.succeed(value);
};

export const buildPreviewRecurringRepairRequest = (
  args: PreviewRepairArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const valid = validateRepair(args.request);
  if (Result.isFailure(valid)) return valid;
  return Result.succeed({
    method: "POST",
    path: `/recurring-transactions/${args.request.recurringTransactionId}/repair/preview`,
    body: args.request,
  });
};

export const buildRepairRecurringFailureRequest = (
  args: RepairArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const valid = validateRepair(args.input);
  if (Result.isFailure(valid)) return valid;
  return Result.succeed({
    method: "POST",
    path: `/recurring-transactions/${args.input.recurringTransactionId}/repair`,
    body: args.input,
  });
};

export const buildRetryRecurringFailureRequest = (
  args: RetryArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (
    !isNonEmptyString(args.input.recurringTransactionId) ||
    !isRevision(args.input.expectedRevision)
  ) {
    return Result.fail(new CommandError("Recurring retry requires id and revision"));
  }
  return Result.succeed({
    method: "POST",
    path: `/recurring-transactions/${args.input.recurringTransactionId}/retry`,
    body: { expectedRevision: args.input.expectedRevision },
  });
};

export const buildMatchingRecurringIdsRequest = (
  args: MatchingIdsArgs,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({
    method: "GET",
    path: "/recurring-transactions/ids",
    query: filterQuery(args.filters),
  });

const buildRecurringBulkRequest = (
  args: BulkArgs,
  path: string,
): Result.Result<WebRequestSpec, CommandError> => {
  if (
    args.request.items.some(
      (item) =>
        !isNonEmptyString(item.recurringTransactionId) || !isRevision(item.expectedRevision),
    )
  ) {
    return Result.fail(new CommandError("Recurring bulk requires an action and valid items"));
  }
  return Result.succeed({ method: "POST", path, body: args.request });
};

export const buildPreflightRecurringBulkRequest = (
  args: BulkArgs,
): Result.Result<WebRequestSpec, CommandError> =>
  buildRecurringBulkRequest(args, "/recurring-transactions/bulk/preflight");
export const buildExecuteRecurringBulkRequest = (
  args: BulkArgs,
): Result.Result<WebRequestSpec, CommandError> =>
  buildRecurringBulkRequest(args, "/recurring-transactions/bulk/execute");
