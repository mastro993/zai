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
  RetryArgs,
  UpdateRecurringArgs,
} from "./web-request-validation";
import {
  filterQuery,
  isNonEmptyString,
  isRecord,
  isRevision,
  parseCursor,
  parseLimit,
  validateFilters,
  validateIdentifier,
  validateLifecycle,
} from "./web-request-validation";

export const buildGetRecurringTransactionsRequest = (
  args: RecurringFeedArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args))
    return Result.fail(new CommandError("Recurring feed arguments must be a record"));
  const limit = parseLimit(args.limit, 50);
  if (Result.isFailure(limit)) return limit;
  const cursor = parseCursor(args.cursor);
  if (Result.isFailure(cursor)) return cursor;
  const filters = validateFilters(args.filters);
  if (Result.isFailure(filters)) return filters;
  return Result.succeed({
    method: "GET",
    path: "/recurring-transactions",
    query: {
      limit: String(limit.value),
      ...(cursor.value ? { cursor: cursor.value } : {}),
      ...filterQuery(filters.value),
    },
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
  if (!isRecord(args))
    return Result.fail(new CommandError("Recurring occurrence arguments must be a record"));
  const limit = parseLimit(args.limit, 50);
  if (Result.isFailure(limit)) return limit;
  const cursor = parseCursor(args.cursor);
  if (Result.isFailure(cursor)) return cursor;
  return Result.succeed({
    method: "GET",
    path: `/recurring-transactions/${identifier.value.recurringTransactionId}/occurrences`,
    query: { limit: String(limit.value), ...(cursor.value ? { cursor: cursor.value } : {}) },
  });
};

export const buildGetRecurringProjectionsRequest = (
  args: ProjectionArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args))
    return Result.fail(new CommandError("Recurring projection arguments must be a record"));
  const horizon = parseLimit(args.horizonMonths, 3);
  if (Result.isFailure(horizon)) return horizon;
  if (args.includePausedBudgets !== undefined && typeof args.includePausedBudgets !== "boolean") {
    return Result.fail(new CommandError("Paused budget option must be boolean"));
  }
  if (
    args.focusRecurringTransactionId !== undefined &&
    !isNonEmptyString(args.focusRecurringTransactionId)
  ) {
    return Result.fail(new CommandError("Projection focus id must be a non-empty string"));
  }
  return Result.succeed({
    method: "GET",
    path: "/recurring-transactions/budget-projections",
    query: {
      horizonMonths: String(horizon.value),
      includePausedBudgets: String(args.includePausedBudgets === true),
      ...(args.focusRecurringTransactionId
        ? { focusRecurringTransactionId: args.focusRecurringTransactionId }
        : {}),
    },
  });
};

export const buildGetRecurringProcessingStatusRequest = (
  _args: void,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({ method: "GET", path: "/recurring-processing/status" });

export const buildGetTransactionProvenanceRequest = (
  args: ProvenanceArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !isNonEmptyString(args.transactionId)) {
    return Result.fail(new CommandError("Transaction id must be a non-empty string"));
  }
  return Result.succeed({
    method: "GET",
    path: `/recurring-transactions/provenance/${args.transactionId}`,
  });
};

export const buildCreateRecurringTransactionRequest = (
  args: CreateRecurringArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !isRecord(args.newRecurringTransaction)) {
    return Result.fail(new CommandError("Recurring transaction payload must be a record"));
  }
  return Result.succeed({
    method: "POST",
    path: "/recurring-transactions",
    body: args.newRecurringTransaction,
  });
};

const validateRequestRecord = (
  value: unknown,
  message: string,
): Result.Result<Record<string, unknown>, CommandError> =>
  isRecord(value) ? Result.succeed(value) : Result.fail(new CommandError(message));

export const buildUpdateRecurringTransactionRequest = (
  args: UpdateRecurringArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const valid = validateRequestRecord(args, "Recurring update requires a request record");
  if (Result.isFailure(valid) || !isRecord(valid.value.input)) {
    return Result.isFailure(valid)
      ? valid
      : Result.fail(new CommandError("Recurring update requires input"));
  }
  if (
    !isNonEmptyString(valid.value.input.recurringTransactionId) ||
    !isRevision(valid.value.input.expectedRevision)
  ) {
    return Result.fail(new CommandError("Recurring update requires id and revision"));
  }
  return Result.succeed({
    method: "POST",
    path: `/recurring-transactions/${valid.value.input.recurringTransactionId}`,
    body: valid.value.input,
  });
};

const buildAdoptionRequest = (
  args: AdoptionArgs,
  path: string,
): Result.Result<WebRequestSpec, CommandError> => {
  const valid = validateRequestRecord(args, "Recurring adoption requires a request record");
  if (Result.isFailure(valid) || !isRecord(valid.value.request)) {
    return Result.isFailure(valid)
      ? valid
      : Result.fail(new CommandError("Recurring adoption requires request"));
  }
  if (!isNonEmptyString(valid.value.request.transactionId)) {
    return Result.fail(new CommandError("Adoption transaction id must be a non-empty string"));
  }
  return Result.succeed({ method: "POST", path, body: valid.value.request });
};

export const buildAdoptRecurringTransactionRequest = (
  args: AdoptionArgs,
): Result.Result<WebRequestSpec, CommandError> =>
  buildAdoptionRequest(args, "/recurring-transactions/adopt");

export const buildPreviewRecurringAdoptionRequest = (
  args: AdoptionPreviewArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const valid = validateRequestRecord(args, "Recurring adoption preview requires a request record");
  if (Result.isFailure(valid) || !isRecord(valid.value.request)) {
    return Result.isFailure(valid)
      ? valid
      : Result.fail(new CommandError("Recurring adoption preview requires request"));
  }
  if (!isNonEmptyString(valid.value.request.transactionId)) {
    return Result.fail(new CommandError("Adoption transaction id must be a non-empty string"));
  }
  const { transactionId, schedule, totalOccurrences } = valid.value.request;
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
  if (!isRecord(args))
    return Result.fail(new CommandError("Recurring failure arguments must be a record"));
  const limit = parseLimit(args.limit, 20);
  if (Result.isFailure(limit)) return limit;
  const cursor = parseCursor(args.cursor);
  if (Result.isFailure(cursor)) return cursor;
  return Result.succeed({
    method: "GET",
    path: `/recurring-transactions/${identifier.value.recurringTransactionId}/failures`,
    query: { limit: String(limit.value), ...(cursor.value ? { cursor: cursor.value } : {}) },
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

const validateRepair = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) &&
  isNonEmptyString(value.recurringTransactionId) &&
  isRevision(value.expectedRevision) &&
  (value.repairFieldKey === "amount" || value.repairFieldKey === "transactionCategoryId") &&
  isRecord(value.template);

export const buildPreviewRecurringRepairRequest = (
  args: PreviewRepairArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !validateRepair(args.request))
    return Result.fail(new CommandError("Recurring repair requires id, revision, and template"));
  return Result.succeed({
    method: "POST",
    path: `/recurring-transactions/${args.request.recurringTransactionId}/repair/preview`,
    body: args.request,
  });
};

export const buildRepairRecurringFailureRequest = (
  args: RepairArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !validateRepair(args.input))
    return Result.fail(new CommandError("Recurring repair requires id, revision, and template"));
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
    !isRecord(args) ||
    !isRecord(args.input) ||
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
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args))
    return Result.fail(new CommandError("Recurring matching arguments must be a record"));
  const filters = validateFilters(args.filters);
  return Result.isFailure(filters)
    ? filters
    : Result.succeed({
        method: "GET",
        path: "/recurring-transactions/ids",
        query: filterQuery(filters.value),
      });
};

const buildRecurringBulkRequest = (
  args: BulkArgs,
  path: string,
): Result.Result<WebRequestSpec, CommandError> => {
  if (
    !isRecord(args) ||
    !isRecord(args.request) ||
    !["pause", "resume", "stop", "delete", "retryNow"].includes(String(args.request.action)) ||
    !Array.isArray(args.request.items) ||
    args.request.items.some(
      (item) =>
        !isRecord(item) ||
        !isNonEmptyString(item.recurringTransactionId) ||
        !isRevision(item.expectedRevision),
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
